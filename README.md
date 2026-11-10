# T2Dev Monetization Center

Desktop-first, multi-app GAMOB revenue analytics platform.

## Important GAMOB integration status

The supplied guide URL currently redirects to the GAMOB login page. The actual authenticated API documentation is therefore not available from the public URL. This project deliberately does **not** invent GAMOB endpoints, query parameters, authentication details, or response field names.

The application, login, application management, analytics UI, database, reconciliation, exports, sync history and scheduler are implemented. Live GAMOB sync becomes operational after the real guide is supplied and the provider-specific field/endpoint mapping is completed in `src/lib/gamob.ts`.

## Revenue rule

GAMOB's displayed revenue is already net of its 20% deduction. The application stores and displays GAMOB's reported amount as-is. No second 20% deduction exists anywhere. Outstanding balance = GAMOB reported amount - actual recorded receipts.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `AUTH_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. The Compose file constructs `DATABASE_URL` from `POSTGRES_PASSWORD` automatically.
3. Start PostgreSQL: `docker compose up -d db`
4. Install dependencies: `npm install`
5. Generate Prisma client: `npx prisma generate`
6. Apply schema: `npx prisma migrate dev --name init`
7. Start: `npm run dev`

For local development, set `DATABASE_URL` in `.env` to point to your local PostgreSQL instance. Coolify Compose deployments construct it automatically from `POSTGRES_PASSWORD`.

## Coolify deployment

Use the repository's `docker-compose.yml` as a single Compose stack. It creates both the Next.js application and PostgreSQL 16; you do not need to provision a separate database resource.

1. Push this repository to a **private** GitHub repository.
2. In Coolify, create an application from the GitHub repository and select Docker Compose with `/docker-compose.yml` as the Compose file path.
3. Add the required variables listed in `COOLIFY_DEPLOYMENT.md`. Set `POSTGRES_PASSWORD`; Compose constructs `DATABASE_URL` automatically using the internal hostname `db`.
4. Configure the public domain on the `app` service at port `3000`, enable HTTPS, and deploy.
5. Coolify starts the app and database together. Container startup runs `prisma migrate deploy` and seeds the initial admin account configuration.
6. The application scheduler attempts an immediate sync at startup and then uses `GAMOB_SYNC_INTERVAL_MINUTES` (default 15). Until the provider mapping is completed, sync history will report that configuration is incomplete.

The Compose stack stores PostgreSQL data in the named `postgres_data` volume. Configure regular backups; a persistent volume is not a backup. Keep one app replica while the in-process scheduler is enabled. See `COOLIFY_DEPLOYMENT.md` for exact variable names and setup instructions.

## Environment variables

See `.env.example`. `ADMIN_PASSWORD` is the plain-text dashboard password stored as a server-side Coolify environment variable. It must never be committed to GitHub.

## API routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/apps`
- `PATCH/DELETE /api/apps/:id`
- `GET /api/analytics/overview`
- `GET /api/analytics/revenue`
- `GET /api/analytics/countries`
- `GET /api/sync/status`
- `POST /api/sync` (admin session or `x-sync-secret`)
- `GET/POST /api/payments`
- `GET /api/export?format=csv|xlsx|pdf` (CSV implemented; XLSX/PDF endpoints are clearly marked as pending extension)
- `GET /api/health`

## Security controls and production checklist

Implemented in the application:

- Admin passwords are verified with plain-text password environment variablees; plaintext admin passwords are not stored.
- Admin sessions are signed JWTs in `HttpOnly`, `Secure` (production), `SameSite=Strict` cookies with a four-hour lifetime.
- Login failures are rate-limited per client address using hashed address identifiers stored in PostgreSQL (3 failed attempts, followed by a 15-minute block).
- Login requests validate the origin when the browser supplies it and accept JSON requests only.
- Private API routes require an admin session, except the deliberately minimal health check and login endpoint. The sync endpoint also supports a separately configured `SYNC_SECRET` header for scheduled jobs.
- GAMOB credentials and tokens remain server-side. GAMOB access and refresh tokens are encrypted at rest using AES-256-GCM with a key derived from `AUTH_SECRET`.
- Search indexing is disabled using Next.js robots metadata, `/robots.txt`, and the `X-Robots-Tag` response header.
- Security headers include a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, a referrer policy, a restrictive permissions policy, and HSTS in production.
- API responses are marked `no-store`; the `X-Powered-By` header is disabled.
- Docker runs the application as a non-root user. `.env` files are excluded from the Docker build context and Git.

Required before production:

1. Deploy behind HTTPS in Coolify and force HTTP-to-HTTPS redirection at the proxy.
2. Set a unique `AUTH_SECRET` generated with `openssl rand -hex 32`. Never reuse it between environments. Changing it invalidates existing GAMOB token encryption and admin sessions; reconnect GAMOB after rotating it.
3. Set a unique `ADMIN_USERNAME` and a strong unique password in `ADMIN_PASSWORD`. Never put the plain password in GitHub.
4. Set a strong unique `POSTGRES_PASSWORD` and restrict PostgreSQL to the private Coolify network. Do not publish its port publicly.
5. Keep `GAMOB_EMAIL`, `GAMOB_PASSWORD`, `GAMOB_API_KEY`, and `SYNC_SECRET` only in Coolify secrets/environment settings. Do not expose them with `NEXT_PUBLIC_` variables.
6. Use one application replica while the in-process scheduler is enabled. If you scale to multiple replicas, move scheduling to one dedicated Coolify Scheduled Task to avoid duplicate syncs.
7. Keep the app, Node.js base image, and dependencies patched. Review dependency advisories before each production release.
8. Back up PostgreSQL and test restoring it. Restrict access to backups because they contain revenue and payment data.

No application can be guaranteed to have zero security risk. These controls reduce common risks, but this change is not a penetration test or an independent security audit. Review the deployment proxy, database access, environment variables, and dependency advisories before exposing the service publicly.

## Current limitation

The public API guide at `https://dashboard.gamob.com/guide/api` redirects to the GAMOB login page. The live provider adapter is intentionally guarded and does not send guessed requests. Upload the authenticated guide (or paste its endpoint/authentication/request/response sections) to finish `src/lib/gamob.ts`. Until then, sync jobs are recorded as failed with a clear configuration message rather than silently importing incorrect data.

The base project is not a substitute for a verified GAMOB connector. Do not deploy expecting live reports until that final adapter mapping is implemented and tested against your account.
