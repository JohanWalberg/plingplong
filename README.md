# Hyrabostad

Swedish rental-housing aggregator: public search, landlord portal and internal
admin, in Swedish and English.

## Local development

Requirements: Node 26, pnpm 11, Docker.

```bash
cp .env.example .env        # already done on first setup
pnpm install
pnpm db:up                  # Postgres 16 + PostGIS on localhost:5433
pnpm db:migrate
pnpm db:seed                # real municipalities, landlords, ~40 listings, users
pnpm dev                    # http://localhost:3000 → /sv or /en
pnpm worker                 # crawler and scheduled jobs (separate process)
```

`pnpm db:reset` drops everything and re-runs migrations and seed.

### Seeded users

All seeded users share the password `hyrabostad-dev-1234`.

| Email | Role |
|---|---|
| lead@hyrabostad.se | Staff, lead |
| support@hyrabostad.se | Staff, support |
| engineer@hyrabostad.se | Staff, engineer |
| anna.lindqvist@signalisten.se | Landlord owner (Signalisten) |
| redaktor@signalisten.se | Landlord editor (Signalisten) |

Staff sign in at `/sv/admin/logga-in`, landlords at `/sv/portal/logga-in`.

## Checks

```bash
pnpm typecheck
pnpm i18n:check   # both message catalogues must have identical keys
pnpm test         # unit tests (parsers, formatters, badge rules)
pnpm test:e2e     # Playwright + axe
```

## Layout

- `src/app/[locale]/…` routes. Translated pathnames live in `src/i18n/routing.ts`.
- `messages/sv.json`, `messages/en.json` message catalogues.
- `src/db/schema.ts` Drizzle schema, `drizzle/` migrations, `src/db/seed.ts` seed.
- `src/worker/` ingestion (pg-boss jobs, adapters, diffing).
- `docs/` design review and product decisions.
