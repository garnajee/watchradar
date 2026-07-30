# WatchRadar

WatchRadar is a private dashboard for Jellyfin circles. Authorized users can
see what friends and family are watching, their in-progress media, and their
history while respecting each person's sharing preferences.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Docker installation](#docker-installation)
  - [1. Check the requirements](#1-check-the-requirements)
  - [2. Download WatchRadar](#2-download-watchradar)
  - [3. Run the setup assistant](#3-run-the-setup-assistant)
  - [4. Verify the containers](#4-verify-the-containers)
  - [5. Configure Nginx Proxy Manager](#5-configure-nginx-proxy-manager)
  - [6. Complete the first-run setup](#6-complete-the-first-run-setup)
- [Reverse proxy](#reverse-proxy)
- [Persistent sessions](#persistent-sessions)
- [Languages](#languages)
- [Main configuration](#main-configuration)
- [Common commands](#common-commands)
- [Local development](#local-development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- Sign in with a Jellyfin account
- Live activity, progress, watch history, and Next up
- Collapsible activity shelves with locally remembered preferences
- Favorites and a responsive interface
- English and French user interfaces
- Per-user sharing modes: `ALL`, `ONLY_WATCHING`, `SELECTED`, or `NONE`
- Administrator-controlled visibility matrix
- Encrypted Jellyfin API key
- Persistent, revocable sessions

Activity is visible only when both privacy rules allow it: the administrator's
visibility matrix and the observed user's sharing preference.

## Architecture

```text
Browser ── HTTPS ──> your reverse proxy
                           │
                           └── HTTP ──> WatchRadar :8080
                                          ├── React
                                          └── /api ──> Express ──> PostgreSQL
                                                               └── HTTPS ──> Jellyfin
```

WatchRadar does not generate or manage public certificates. Your reverse proxy
(Caddy, Nginx, Traefik, Nginx Proxy Manager, and so on) owns the domain,
terminates HTTPS, and forwards traffic to WatchRadar's single HTTP port.

The WatchRadar → Jellyfin connection must remain HTTPS because it transports
Jellyfin credentials and the API key. It is independent from the public
certificate installed on your reverse proxy.

## Docker installation

This is the recommended installation path for a new server. WatchRadar runs as
three containers: the web entrypoint, the private API, and PostgreSQL.

### 1. Check the requirements

The server needs:

- Git
- Bash and OpenSSL
- Docker Engine
- Docker Compose v2 (`docker compose`) or standalone Compose (`docker-compose`)
- A domain such as `watchradar.example.com`
- A reverse proxy that provides HTTPS
- A Jellyfin server reachable over HTTPS from Docker

Point the domain to your reverse proxy before continuing.

### 2. Download WatchRadar

```bash
git clone https://github.com/garnajee/watchradar.git
cd watchradar
```

### 3. Run the setup assistant

The easiest option is the interactive assistant:

```bash
./scripts/setup.sh
```

It asks for:

- the public WatchRadar URL, for example
  `https://watchradar.example.com`;
- the Jellyfin HTTPS URL reachable from the backend container;
- the address and port exposed to the reverse proxy;
- whether the Docker containers should start immediately.

The assistant then:

- generates strong database, JWT, and encryption secrets;
- creates the single `.env` file at the project root with `0600` permissions;
- validates the Docker Compose configuration;
- builds and starts WatchRadar when requested;
- prints the HTTP upstream to use in the reverse proxy.

If you choose not to start the containers during setup, start them later with:

```bash
docker compose up -d --build
```

For a fully automated installation with a containerized reverse proxy such as
Nginx Proxy Manager:

```bash
./scripts/setup.sh \
  --public-url https://watchradar.example.com \
  --jellyfin-url https://jellyfin.example.com \
  --bind-address 0.0.0.0 \
  --port 8080 \
  --start \
  --non-interactive
```

Use `--bind-address 127.0.0.1` instead when the reverse proxy runs directly on
the same host and is not inside a container.

Existing valid secrets are reused when the script runs again.
`ENCRYPTION_KEY` is never rotated automatically because it protects the
Jellyfin API key stored in PostgreSQL.

### 4. Verify the containers

```bash
docker compose ps
curl http://127.0.0.1:8080/api/health
```

The three services should be running, the database and backend should be
healthy, and the health endpoint should return:

```json
{"status":"ok","service":"watchradar-api"}
```

If your system uses standalone Compose, replace `docker compose` with
`docker-compose`.

### 5. Configure Nginx Proxy Manager

Create a new **Proxy Host**:

| Field | Value |
|---|---|
| Domain Names | `watchradar.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | IP address of the WatchRadar Docker host |
| Forward Port | `8080` |

When Nginx Proxy Manager itself runs in Docker, do not use `127.0.0.1` as the
forward hostname: that address points back to the NPM container. Use the
WatchRadar host's LAN address or connect both projects to a shared Docker
network.

In the **SSL** tab:

1. request or select a certificate;
2. enable **Force SSL**;
3. enable HTTP/2 if desired;
4. save the Proxy Host.

Add this under **Advanced** so real-time SSE connections are not buffered or
closed too early:

```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Only the reverse proxy should be allowed to reach port `8080`. Restrict it with
the server firewall when it is bound to `0.0.0.0`.

> Port `8080` serves plain HTTP for the reverse proxy. Do not open
> `https://server-ip:8080`. For normal use and authentication, always open the
> public HTTPS URL configured as `FRONTEND_ORIGIN`.

### 6. Complete the first-run setup

1. Open `https://watchradar.example.com`.
2. Sign in with a Jellyfin administrator account.
3. Create a key in Jellyfin under **Dashboard → Advanced → API Keys**.
4. Open **Administration** in WatchRadar and save that API key.
5. Synchronize the Jellyfin users.
6. Enable the users allowed to access WatchRadar.
7. Configure the visibility matrix.

The Jellyfin password is never stored. The API key is encrypted server-side and
is never returned to the browser.

## Reverse proxy

Forward the entire domain to the same WatchRadar upstream. The included Nginx
instance already routes `/api` to the private backend.

Caddy example:

```caddyfile
watchradar.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Nginx example:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
```

`proxy_buffering off` and the long timeout are required for the real-time SSE
stream.

Keep `WATCHRADAR_BIND_ADDRESS=127.0.0.1` when the reverse proxy runs directly
on the same host. For a containerized or remote proxy, use `0.0.0.0` and limit
the port to a trusted network with your firewall.

## Persistent sessions

A session remains active for up to 180 days after its last use:

- Short-lived access tokens are renewed automatically, including after the
  browser is closed and reopened.
- Session tokens are random, stored as hashes, and rotated on every renewal.
- Signing out or disabling an account revokes its sessions server-side.
- Each user can keep up to ten device sessions.

Cookies are `httpOnly`, `Secure`, and `SameSite=Strict`, so the public URL must
actually use HTTPS.

## Languages

English is the default language. Each user can switch between **English** and
**Français** under **Settings → Interface language**. The preference is stored
on the user account and remembered locally for the next sign-in screen.

All interface copy is centralized in:

```text
frontend/src/locales/en.json
frontend/src/locales/fr.json
```

Both dictionaries must contain the same keys; the automated tests enforce this.

## Main configuration

| Variable | Purpose |
|---|---|
| `FRONTEND_ORIGIN` | Public HTTPS origin without a trailing slash |
| `JELLYFIN_URL` | Jellyfin HTTPS URL reachable from the backend container |
| `WATCHRADAR_BIND_ADDRESS` | HTTP bind address; use `127.0.0.1` when possible |
| `WATCHRADAR_HTTP_PORT` | Reverse-proxy upstream port; defaults to `8080` |
| `JELLYFIN_TLS_REJECT_UNAUTHORIZED` | Jellyfin certificate validation; keep `true` in production |

Every variable is documented in [.env.example](.env.example).

Do not use `https://localhost:8096` for Jellyfin from Docker:
`localhost` would refer to the backend container itself.

## Common commands

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose up -d --build
docker compose down
```

PostgreSQL data is stored in the `postgres_data` volume. Prisma migrations are
applied automatically when the backend starts.

Database backup:

```bash
docker compose exec -T db pg_dump -U watchradar watchradar > watchradar.sql
```

## Local development

Node.js 24 or newer is required. Local development also uses only the root
`.env` file:

```bash
npm install
docker compose up -d db
npm run db:generate
npm run dev
```

React is available at `http://localhost:5173`; Vite forwards `/api` to the
local backend.

Run the full validation suite with:

```bash
npm run typecheck
npm test
npm run build
docker compose config
```

## Troubleshooting

- Health endpoint: `https://your-domain.example/api/health`
- Offline dashboard: check the Jellyfin URL, API key, and TLS certificate.
- Unstable live updates: disable reverse-proxy buffering and increase its
  read timeout.
- CORS errors: `FRONTEND_ORIGIN` must exactly match the public HTTPS origin.

## License

Released under the [MIT License](LICENSE).
