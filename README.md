# WatchRadar

WatchRadar is a private dashboard for Jellyfin circles. Authorized users can
see what friends and family are watching, their in-progress media, and their
history while respecting each person's sharing preferences.

Production installation uses prebuilt images from GitHub Container Registry.
You only need a Docker Compose file and an `.env` file: cloning the repository
is not required.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Docker installation](#docker-installation)
  - [1. Check the requirements](#1-check-the-requirements)
  - [2. Download the two deployment files](#2-download-the-two-deployment-files)
  - [3. Configure the environment](#3-configure-the-environment)
  - [4. Start WatchRadar](#4-start-watchradar)
  - [5. Configure Nginx Proxy Manager](#5-configure-nginx-proxy-manager)
  - [6. Complete the first-run setup](#6-complete-the-first-run-setup)
- [Updating](#updating)
- [Reverse proxy](#reverse-proxy)
- [Persistent sessions](#persistent-sessions)
- [Languages](#languages)
- [Configuration](#configuration)
- [Common commands](#common-commands)
- [Publishing container images](#publishing-container-images)
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

This is the recommended path for a server. It pulls the prebuilt WatchRadar
images and does not download the source code.

### 1. Check the requirements

The server needs:

- Docker Engine and Docker Compose v2 (`docker compose`)
- `curl` and OpenSSL
- A domain such as `watchradar.example.com`
- A reverse proxy that provides HTTPS
- A Jellyfin server reachable over HTTPS from Docker

Point the domain to your reverse proxy before continuing.

### 2. Download the two deployment files

```bash
mkdir watchradar
cd watchradar

curl -fsSL \
  https://raw.githubusercontent.com/garnajee/watchradar/main/docker-compose.prod.yml \
  -o docker-compose.yml

curl -fsSL \
  https://raw.githubusercontent.com/garnajee/watchradar/main/.env.production.example \
  -o .env

chmod 600 .env
```

The directory now contains everything required for deployment:

```text
watchradar/
├── docker-compose.yml
└── .env
```

### 3. Configure the environment

Generate the four independent secrets:

```bash
sed -i \
  -e "s/CHANGE_ME_DB_PASSWORD/$(openssl rand -hex 32)/" \
  -e "s/CHANGE_ME_JWT_SECRET/$(openssl rand -hex 32)/" \
  -e "s/CHANGE_ME_JWT_REFRESH_SECRET/$(openssl rand -hex 32)/" \
  -e "s/CHANGE_ME_ENCRYPTION_KEY/$(openssl rand -hex 32)/" \
  .env
```

Then open `.env` in an editor and set:

- `FRONTEND_ORIGIN` to the public HTTPS URL, without a trailing slash;
- `JELLYFIN_URL` to the HTTPS URL reachable from the backend container;
- `WATCHRADAR_BIND_ADDRESS` to the address your reverse proxy can reach.

Use `127.0.0.1` when the reverse proxy runs directly on the same host. Keep
`0.0.0.0` for a containerized proxy such as Nginx Proxy Manager, and restrict
port `8080` to trusted hosts with the server firewall.

Back up `.env`. In particular, never regenerate `ENCRYPTION_KEY` after setup:
changing it would make the stored Jellyfin API key unreadable.

### 4. Start WatchRadar

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Verify the HTTP entrypoint:

```bash
curl http://127.0.0.1:8080/api/health
```

It should return:

```json
{"status":"ok","service":"watchradar-api"}
```

Only the frontend port is published. The backend and PostgreSQL remain private
inside the Compose network. Database migrations run automatically when the
backend starts.

### 5. Configure Nginx Proxy Manager

Create a new **Proxy Host**:

| Field | Value |
|---|---|
| Domain Names | `watchradar.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | IP address of the WatchRadar Docker host |
| Forward Port | `8080` |

When Nginx Proxy Manager runs in Docker, do not use `127.0.0.1` as the forward
hostname: that address points back to the NPM container. Use the WatchRadar
host's LAN address or connect both projects to a shared Docker network.

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

Port `8080` serves plain HTTP for the reverse proxy. Do not open
`https://server-ip:8080`; use the public HTTPS URL configured in
`FRONTEND_ORIGIN`.

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

## Updating

The default `WATCHRADAR_VERSION=latest` tracks the most recent image published
from `main`. To update:

```bash
cd watchradar
docker compose pull
docker compose up -d
docker compose ps
```

To pin an installation, set `WATCHRADAR_VERSION` to a published release tag,
for example `1.2.0`, before pulling. Keep the existing `.env` and
`postgres_data` volume during updates.

## Reverse proxy

Forward the entire domain to the same WatchRadar upstream. The Nginx instance
inside the frontend image already routes `/api` to the private backend.

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

`proxy_buffering off` and the long timeout preserve the real-time SSE stream.

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

Both dictionaries must contain the same keys; automated tests enforce this.

## Configuration

| Variable | Purpose |
|---|---|
| `WATCHRADAR_VERSION` | GHCR image tag; defaults to `latest` |
| `FRONTEND_ORIGIN` | Public HTTPS origin without a trailing slash |
| `JELLYFIN_URL` | Jellyfin HTTPS URL reachable from the backend |
| `WATCHRADAR_BIND_ADDRESS` | HTTP bind address for the reverse proxy |
| `WATCHRADAR_HTTP_PORT` | HTTP port; defaults to `8080` |
| `JELLYFIN_TLS_REJECT_UNAUTHORIZED` | Jellyfin certificate validation; keep `true` in production |

The production variables are documented in
[.env.production.example](.env.production.example). Source builds and local
development use the broader [.env.example](.env.example).

## Common commands

Run these commands from the deployment directory:

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose pull
docker compose up -d
docker compose down
```

PostgreSQL data is stored in the `postgres_data` volume.

Database backup:

```bash
docker compose exec -T db pg_dump -U watchradar watchradar > watchradar.sql
```

## Publishing container images

The
[`Publish container images`](.github/workflows/publish-container-images.yml)
workflow publishes the frontend and backend images to GHCR for `linux/amd64`
and `linux/arm64`:

- every push to `main` publishes `latest` and a commit tag;
- a Git tag such as `v1.2.0` publishes versioned tags;
- the workflow can also be started manually.

Images:

- `ghcr.io/garnajee/watchradar-frontend`
- `ghcr.io/garnajee/watchradar-backend`

Both packages are linked to this public repository and can be pulled
anonymously: users do not need a GitHub account or `docker login`. If a fork
publishes private packages instead, its owner must change each package's
visibility under **Package settings → Change visibility → Public**.

The root [`docker-compose.yml`](docker-compose.yml) intentionally keeps its
`build` sections for source builds and local development. Production servers
should use [`docker-compose.prod.yml`](docker-compose.prod.yml).

## Local development

Node.js 24 or newer is required. Clone the repository only when developing or
building the images locally:

```bash
git clone https://github.com/garnajee/watchradar.git
cd watchradar
cp .env.example .env
```

Edit the root `.env`, keeping `DB_PASSWORD`, `DB_PASSWORD_URLENCODED`, and
`DATABASE_URL` consistent. Then run:

```bash
npm install
docker compose up -d db
npm run db:generate
npm run dev
```

React is available at `http://localhost:5173`; Vite forwards `/api` to the
local backend.

For a source-built Docker deployment, `./scripts/setup.sh` can generate the
root `.env` and start the build-based Compose stack.

Run the validation suite with:

```bash
npm run typecheck
npm test
npm run build
docker compose config
docker compose -f docker-compose.prod.yml config
```

## Troubleshooting

- `denied` while pulling from GHCR: both packages must be public.
- `SSL_ERROR_RX_RECORD_TOO_LONG` on port `8080`: use `http://` for the internal
  port, not `https://`.
- `The request origin is not allowed`: `FRONTEND_ORIGIN` must exactly match the
  URL shown in the browser.
- Offline dashboard: check the Jellyfin URL, API key, and TLS certificate.
- Unstable live updates: disable reverse-proxy buffering and increase its read
  timeout.

## License

Released under the [MIT License](LICENSE).
