# WatchRadar contributor guide

## Scope

These instructions apply to the entire repository.

## Project shape

- `backend/`: Node.js 24 LTS, Express, TypeScript, Prisma and PostgreSQL.
- `frontend/`: React 18, Vite, TypeScript and Tailwind CSS.
- `scripts/`: developer and deployment helpers.
- `.github/workflows/`: validation and GHCR image publication.

## Working agreements

- Keep Jellyfin credentials and API keys server-side. Never expose the admin API key to the browser or logs.
- Preserve the two-part privacy check: an administrator's visibility matrix grants the relationship, and the target user's sharing preference limits the content.
- Terminate public HTTPS at the user-managed reverse proxy. WatchRadar's frontend is the
  single HTTP entrypoint and proxies `/api` to the unexposed backend.
- Keep `docker-compose.yml` build-based for local/source deployments and
  `docker-compose.prod.yml` image-based for no-clone production deployments.
- Keep secure-cookie and proxy-hop settings aligned with that two-proxy production path.
- Validate request bodies at API boundaries with Zod.
- Add or update tests for authorization, privacy filtering, crypto, and other security-sensitive logic.
- Use Prisma migrations for persistent schema changes.
- Keep the UI responsive and keyboard accessible. All interactive controls need visible focus states and labels.
- Keep every user-facing frontend string in `frontend/src/locales/en.json` and
  `frontend/src/locales/fr.json`; both dictionaries must expose the same keys.
- Update `README.md`, `.env.example`, and `.env.production.example` whenever
  deployment variables or setup steps change.

## Before handing off a change

Run:

```bash
npm run typecheck
npm test
npm run build
docker compose config
docker compose -f docker-compose.prod.yml config
```

Do not commit `.env`, TLS private keys, database data, build output, or dependency folders.
