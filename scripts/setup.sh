#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  printf 'Error: this script must be run with Bash.\n' >&2
  exit 1
fi

set -Eeuo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(dirname "$script_dir")
env_file="$project_dir/.env"

public_url=""
jellyfin_url=""
bind_address=""
http_port=""
start_stack=false
non_interactive=false
working_file=""
compose_command=()

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [options]

Create or safely update the root .env file for WatchRadar.

Options:
  --public-url URL       Public HTTPS URL, for example https://watchradar.example.com
  --jellyfin-url URL     HTTPS URL reachable from the backend container
  --bind-address ADDRESS IPv4 address used for the HTTP port (default: 0.0.0.0)
  --port PORT            HTTP port exposed to the reverse proxy (default: 8080)
  --start                Build and start the Docker Compose stack
  --non-interactive      Never prompt; fail when a required value is unavailable
  -h, --help             Show this help

Existing valid secrets are always reused. The script never rotates ENCRYPTION_KEY.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'Warning: %s\n' "$*" >&2
}

while (($# > 0)); do
  case "$1" in
    --public-url)
      (($# >= 2)) || die "--public-url requires a value"
      public_url=$2
      shift 2
      ;;
    --public-url=*)
      public_url=${1#*=}
      shift
      ;;
    --jellyfin-url)
      (($# >= 2)) || die "--jellyfin-url requires a value"
      jellyfin_url=$2
      shift 2
      ;;
    --jellyfin-url=*)
      jellyfin_url=${1#*=}
      shift
      ;;
    --bind-address)
      (($# >= 2)) || die "--bind-address requires a value"
      bind_address=$2
      shift 2
      ;;
    --bind-address=*)
      bind_address=${1#*=}
      shift
      ;;
    --port)
      (($# >= 2)) || die "--port requires a value"
      http_port=$2
      shift 2
      ;;
    --port=*)
      http_port=${1#*=}
      shift
      ;;
    --start)
      start_stack=true
      shift
      ;;
    --non-interactive)
      non_interactive=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

command -v openssl >/dev/null 2>&1 || die "OpenSSL is required to generate secrets"

get_env_value() {
  local key=$1
  [[ -f "$env_file" ]] || return 0
  awk -v requested_key="$key" '
    index($0, requested_key "=") == 1 {
      value = substr($0, length(requested_key) + 2)
      found = 1
    }
    END {
      if (found) print value
    }
  ' "$env_file"
}

strip_quotes() {
  local value=$1
  if [[ ${#value} -ge 2 ]]; then
    if [[ ${value:0:1} == '"' && ${value: -1} == '"' ]]; then
      value=${value:1:${#value}-2}
    elif [[ ${value:0:1} == "'" && ${value: -1} == "'" ]]; then
      value=${value:1:${#value}-2}
    fi
  fi
  printf '%s' "$value"
}

is_placeholder() {
  local value=$1
  [[ -z "$value" || "$value" == replace-with-* ]]
}

existing_db_password=$(strip_quotes "$(get_env_value DB_PASSWORD)")
if [[ -n "$existing_db_password" ]] && is_placeholder "$existing_db_password" &&
  command -v docker >/dev/null 2>&1; then
  if docker volume inspect watchradar_postgres_data >/dev/null 2>&1; then
    die "the existing DB_PASSWORD is a placeholder but the watchradar_postgres_data volume already exists; refusing to rotate it automatically because PostgreSQL would keep the old password"
  elif ! docker info >/dev/null 2>&1; then
    die "Docker is installed but the script cannot verify whether a PostgreSQL volume exists; start Docker before replacing an existing DB_PASSWORD placeholder"
  fi
fi

resolve_secret() {
  local key=$1
  local value
  value=$(strip_quotes "$(get_env_value "$key")")

  if is_placeholder "$value"; then
    openssl rand -hex 32
    return
  fi

  case "$key" in
    ENCRYPTION_KEY)
      [[ "$value" =~ ^[[:xdigit:]]{64}$ ]] ||
        die "existing ENCRYPTION_KEY is invalid; it was not replaced"
      ;;
    JWT_SECRET|JWT_REFRESH_SECRET)
      [[ ${#value} -ge 32 && "$value" =~ ^[a-zA-Z0-9._~+/=-]+$ ]] ||
        die "existing $key is invalid or unsafe for an unquoted .env value; it was not replaced"
      ;;
    DB_PASSWORD)
      [[ "$value" =~ ^[a-zA-Z0-9._~+/=@:-]+$ ]] ||
        die "existing DB_PASSWORD contains characters unsupported by this .env format"
      ;;
  esac

  printf '%s' "$value"
}

trim_trailing_slashes() {
  local value=$1
  while [[ "$value" == */ ]]; do
    value=${value%/}
  done
  printf '%s' "$value"
}

is_https_authority() {
  local authority=$1
  local port=""

  if [[ "$authority" =~ ^\[[0-9a-fA-F:.]+\](:([0-9]{1,5}))?$ ]]; then
    port=${BASH_REMATCH[2]:-}
  elif [[ "$authority" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:([0-9]{1,5}))?$ &&
    "$authority" != *..* ]]; then
    port=${BASH_REMATCH[3]:-}
  else
    return 1
  fi

  [[ -z "$port" ]] || is_port "$port"
}

is_public_https_origin() {
  local value=$1
  local authority
  [[ "$value" == https://* ]] || return 1
  authority=${value#https://}
  [[ -n "$authority" && "$authority" != */* && "$authority" != *"?"* &&
    "$authority" != *"#"* && "$authority" != *"@"* &&
    "$authority" != *"\\"* && "$authority" != *[[:space:]]* ]] || return 1
  is_https_authority "$authority"
}

is_jellyfin_https_url() {
  local value=$1
  local remainder
  local authority
  [[ "$value" == https://* && "$value" != *"?"* && "$value" != *"#"* &&
    "$value" != *"@"* && "$value" != *"\\"* &&
    "$value" != *[[:space:]]* ]] || return 1
  remainder=${value#https://}
  authority=${remainder%%/*}
  [[ -n "$authority" ]] || return 1
  is_https_authority "$authority"
}

is_ipv4_address() {
  local value=$1
  local octets
  local octet
  IFS=. read -r -a octets <<<"$value"
  [[ ${#octets[@]} -eq 4 ]] || return 1
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^[0-9]{1,3}$ && 10#$octet -le 255 ]] || return 1
  done
}

is_port() {
  local value=$1
  [[ "$value" =~ ^[0-9]+$ && 10#$value -ge 1 && 10#$value -le 65535 ]]
}

prompt_required() {
  local label=$1
  local current=$2
  local value

  while true; do
    if [[ -n "$current" ]]; then
      read -r -p "$label [$current]: " value
      printf '%s' "${value:-$current}"
    else
      read -r -p "$label: " value
      if [[ -n "$value" ]]; then
        printf '%s' "$value"
      else
        warn "a value is required"
        continue
      fi
    fi
    return
  done
}

existing_public_url=$(strip_quotes "$(get_env_value FRONTEND_ORIGIN)")
existing_jellyfin_url=$(strip_quotes "$(get_env_value JELLYFIN_URL)")
existing_bind_address=$(strip_quotes "$(get_env_value WATCHRADAR_BIND_ADDRESS)")
existing_http_port=$(strip_quotes "$(get_env_value WATCHRADAR_HTTP_PORT)")

if [[ -z "$public_url" ]]; then
  if [[ "$non_interactive" == true ]]; then
    public_url=$existing_public_url
  else
    [[ -t 0 ]] || die "interactive input is unavailable; use --non-interactive with URL options"
    public_url=$(prompt_required "Public HTTPS URL" "$existing_public_url")
  fi
fi
public_url=$(trim_trailing_slashes "$public_url")
is_public_https_origin "$public_url" ||
  die "the public URL must be an HTTPS origin without a path, query, fragment, or trailing slash"

if [[ -z "$jellyfin_url" ]]; then
  if [[ "$non_interactive" == true ]]; then
    jellyfin_url=$existing_jellyfin_url
  else
    jellyfin_url=$(prompt_required "Jellyfin HTTPS URL" "$existing_jellyfin_url")
  fi
fi
jellyfin_url=$(trim_trailing_slashes "$jellyfin_url")
is_jellyfin_https_url "$jellyfin_url" ||
  die "the Jellyfin URL must use HTTPS and must not contain a query or fragment"

bind_address=${bind_address:-${existing_bind_address:-0.0.0.0}}
is_ipv4_address "$bind_address" ||
  die "the bind address must be an IPv4 address such as 0.0.0.0 or 127.0.0.1"

http_port=${http_port:-${existing_http_port:-8080}}
is_port "$http_port" || die "the HTTP port must be between 1 and 65535"

db_password=$(resolve_secret DB_PASSWORD)
jwt_secret=$(resolve_secret JWT_SECRET)
jwt_refresh_secret=$(resolve_secret JWT_REFRESH_SECRET)
encryption_key=$(resolve_secret ENCRYPTION_KEY)
[[ "$jwt_secret" != "$jwt_refresh_secret" ]] ||
  die "JWT_SECRET and JWT_REFRESH_SECRET must be different; neither value was replaced"

percent_encode() {
  local value=$1
  local encoded=""
  local character
  local hex
  local index
  LC_ALL=C
  for ((index = 0; index < ${#value}; index++)); do
    character=${value:index:1}
    case "$character" in
      [a-zA-Z0-9.~_-])
        encoded+=$character
        ;;
      *)
        printf -v hex '%%%02X' "'$character"
        encoded+=$hex
        ;;
    esac
  done
  printf '%s' "$encoded"
}

database_url=$(strip_quotes "$(get_env_value DATABASE_URL)")
encoded_db_password=$(percent_encode "$db_password")
if is_placeholder "$database_url"; then
  database_url="postgresql://watchradar:${encoded_db_password}@127.0.0.1:5432/watchradar"
fi
[[ "$database_url" == postgresql://* && "$database_url" != *[[:space:]#\$]* ]] ||
  die "DATABASE_URL must be a PostgreSQL URL without whitespace, #, or $"

postgres_host_port=$(strip_quotes "$(get_env_value POSTGRES_HOST_PORT)")
postgres_host_port=${postgres_host_port:-5432}
is_port "$postgres_host_port" || die "POSTGRES_HOST_PORT must be between 1 and 65535"

trust_proxy_hops=$(strip_quotes "$(get_env_value TRUST_PROXY_HOPS)")
trust_proxy_hops=${trust_proxy_hops:-2}
[[ "$trust_proxy_hops" =~ ^[0-9]+$ && 10#$trust_proxy_hops -le 10 ]] ||
  die "TRUST_PROXY_HOPS must be between 0 and 10"

jellyfin_tls=$(strip_quotes "$(get_env_value JELLYFIN_TLS_REJECT_UNAUTHORIZED)")
jellyfin_tls=${jellyfin_tls:-true}
[[ "$jellyfin_tls" == true || "$jellyfin_tls" == false ]] ||
  die "JELLYFIN_TLS_REJECT_UNAUTHORIZED must be true or false"

log_level=$(strip_quotes "$(get_env_value LOG_LEVEL)")
log_level=${log_level:-info}
[[ "$log_level" =~ ^(fatal|error|warn|info|debug|trace|silent)$ ]] ||
  die "LOG_LEVEL must be fatal, error, warn, info, debug, trace, or silent"

umask 077
working_file=$(mktemp "$project_dir/.env.setup.XXXXXX")
cleanup() {
  if [[ -n "$working_file" && -f "$working_file" ]]; then
    rm -f -- "$working_file"
  fi
}
trap cleanup EXIT

if [[ -f "$env_file" ]]; then
  cp -- "$env_file" "$working_file"
else
  printf '# Generated by scripts/setup.sh\n' >"$working_file"
fi

set_env_value() {
  local target_file=$1
  local key=$2
  local value=$3
  local next_file
  next_file=$(mktemp "$project_dir/.env.setup.XXXXXX")
  awk -v requested_key="$key" -v requested_value="$value" '
    index($0, requested_key "=") == 1 {
      if (!updated) {
        print requested_key "=" requested_value
        updated = 1
      }
      next
    }
    { print }
    END {
      if (!updated) print requested_key "=" requested_value
    }
  ' "$target_file" >"$next_file"
  mv -f -- "$next_file" "$target_file"
}

remove_legacy_values() {
  local target_file=$1
  local next_file
  next_file=$(mktemp "$project_dir/.env.setup.XXXXXX")
  awk '
    index($0, "FRONTEND_HTTPS_PORT=") == 1 { next }
    index($0, "BACKEND_HTTPS_PORT=") == 1 { next }
    index($0, "TLS_CERT_FILE=") == 1 { next }
    index($0, "TLS_KEY_FILE=") == 1 { next }
    index($0, "VITE_API_URL=") == 1 { next }
    { print }
  ' "$target_file" >"$next_file"
  mv -f -- "$next_file" "$target_file"
}

remove_legacy_values "$working_file"
set_env_value "$working_file" DB_PASSWORD "$db_password"
set_env_value "$working_file" DB_PASSWORD_URLENCODED "$encoded_db_password"
set_env_value "$working_file" DATABASE_URL "$database_url"
set_env_value "$working_file" POSTGRES_HOST_PORT "$postgres_host_port"
set_env_value "$working_file" JWT_SECRET "$jwt_secret"
set_env_value "$working_file" JWT_REFRESH_SECRET "$jwt_refresh_secret"
set_env_value "$working_file" ENCRYPTION_KEY "$encryption_key"
set_env_value "$working_file" FRONTEND_ORIGIN "$public_url"
set_env_value "$working_file" WATCHRADAR_BIND_ADDRESS "$bind_address"
set_env_value "$working_file" WATCHRADAR_HTTP_PORT "$http_port"
set_env_value "$working_file" TRUST_PROXY_HOPS "$trust_proxy_hops"
set_env_value "$working_file" COOKIE_SECURE true
set_env_value "$working_file" JELLYFIN_TLS_REJECT_UNAUTHORIZED "$jellyfin_tls"
set_env_value "$working_file" JELLYFIN_URL "$jellyfin_url"
set_env_value "$working_file" LOG_LEVEL "$log_level"
chmod 600 "$working_file"

docker_compose_available=false
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker_compose_available=true
  compose_command=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 &&
  docker-compose version >/dev/null 2>&1; then
  docker_compose_available=true
  compose_command=(docker-compose)
fi

if [[ "$docker_compose_available" == true ]]; then
  (
    cd "$project_dir"
    "${compose_command[@]}" --env-file "$working_file" config --quiet
  ) || die "Docker Compose rejected the generated configuration"
elif [[ "$start_stack" == true ]]; then
  die "Docker Compose is required with --start"
else
  warn "Docker Compose was not found; the generated configuration could not be validated"
fi

mv -f -- "$working_file" "$env_file"
working_file=""
chmod 600 "$env_file"
printf 'WatchRadar configuration written to %s\n' "$env_file"

if [[ "$non_interactive" == false && "$start_stack" == false ]]; then
  read -r -p "Build and start WatchRadar now? [Y/n] " answer
  case "${answer:-Y}" in
    [Yy]|[Yy][Ee][Ss])
      start_stack=true
      ;;
  esac
fi

if [[ "$start_stack" == true ]]; then
  [[ "$docker_compose_available" == true ]] || die "Docker Compose is required to start WatchRadar"
  (
    cd "$project_dir"
    "${compose_command[@]}" up -d --build
    "${compose_command[@]}" ps
  )
fi

if [[ "$bind_address" == "127.0.0.1" ]]; then
  upstream_host=127.0.0.1
else
  upstream_host="<watchradar-host>"
fi

printf '\nReverse proxy upstream: http://%s:%s\n' "$upstream_host" "$http_port"
printf 'Public URL: %s\n' "$public_url"
printf 'TLS certificates and the Jellyfin API key are not generated by this script.\n'
