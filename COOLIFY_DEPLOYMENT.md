# Deploy with GitHub + Coolify (single Compose stack)

This repository deploys the Next.js application and PostgreSQL 16 together. Coolify creates both services from `docker-compose.yml`; no separate database resource or manually composed database URL is needed.

## Coolify setup

1. Push this repository to GitHub. Make it **Private** before using real credentials.
2. In Coolify, create a resource from the repository and select Docker Compose with `/docker-compose.yml`.
3. Add the six required environment variables below.
4. Configure the public domain on the `app` service, target port `3000`, and enable HTTPS.
5. Deploy. The `postgres_data` named volume preserves the database across normal redeployments.

## Required environment variables

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | A strong database password. Use letters and numbers; avoid `$`, `@`, `:`, `/`, `?`, `#` and spaces. |
| `ADMIN_USERNAME` | Your dashboard login username |
| `ADMIN_PASSWORD` | Your dashboard login password in plain text, entered only in Coolify |
| `AUTH_SECRET` | A random secret of at least 32 characters; generate with `openssl rand -hex 32` |
| `SYNC_SECRET` | A different random secret; generate with `openssl rand -hex 32` |

The sixth variable is `GAMOB_SYNC_INTERVAL_MINUTES`, which is optional and defaults to `15`. GAMOB credentials are also optional until the provider adapter is completed.

## Database connection

Do not add `DATABASE_URL` manually in Coolify. Compose builds it internally from `POSTGRES_PASSWORD` and the internal service hostname `db`:

`postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/t2dev_monetization?schema=public`

The app and database share the Compose network. PostgreSQL is not published to the internet.

## Security and operations

- The admin password is now supplied as a plain-text environment variable. It is not committed to GitHub, but it is stored as a Coolify environment secret and available to the application process. Use a unique, long password and keep the GitHub repository private.
- Login attempts are rate-limited to three failures followed by a 15-minute block. Session cookies remain HttpOnly, Secure in production, and expire after four hours.
- Back up the PostgreSQL volume. A persistent volume is not a backup.
- Keep one app replica while the in-process scheduler is enabled.
- The GAMOB adapter still requires validation against authenticated GAMOB API documentation. A successful deployment does not mean live GAMOB synchronization is ready.
