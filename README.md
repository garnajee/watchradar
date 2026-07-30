# WatchRadar

WatchRadar is a private dashboard for Jellyfin circles. Authorized users can
see what friends and family are watching, their in-progress media, and their
history while respecting each person's sharing preferences.

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

## Installation

Requirements:

- Docker with Docker Compose v2
- A Jellyfin server reachable over HTTPS
- An HTTPS domain handled by your reverse proxy

Clone the repository and run the setup assistant:

```bash
git clone https://github.com/garnajee/watchradar.git
cd watchradar
./scripts/setup.sh
```

The script creates the only configuration file, `.env` at the project root,
generates secure secrets, validates the Compose configuration, and offers to
start the containers.

For an automated installation:

```bash
./scripts/setup.sh \
  --public-url https://watchradar.example.com \
  --jellyfin-url https://jellyfin.example.com \
  --bind-address 127.0.0.1 \
  --port 8080 \
  --start \
  --non-interactive
```

Existing valid secrets are reused. In particular, `ENCRYPTION_KEY` is never
rotated automatically because it protects the Jellyfin API key already stored
in the database.

After WatchRadar starts:

1. Open its public HTTPS URL.
2. Sign in with a Jellyfin administrator account.
3. Open **Administration** and save a Jellyfin API key.
4. Synchronize and enable the users you want to allow.
5. Configure the visibility matrix.

Create the API key in Jellyfin under
**Dashboard → Advanced → API Keys**. It is encrypted server-side and is never
returned to the browser.

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
