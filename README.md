# plingplong

Swedish rental-housing aggregator: public search, landlord portal and internal
admin, in Swedish and English.

## Local development

Requirements: Node 26, pnpm 11, Docker.

```bash
pnpm install
pnpm start:all              # database, migrations, seed, web on :3000 and worker
pnpm start:all --reset      # same, but drops and reseeds the database first
```

Or step by step:

```bash
cp .env.example .env
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
| lead@plingplong.se | Staff, lead |
| support@plingplong.se | Staff, support |
| engineer@plingplong.se | Staff, engineer |
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

## End-to-end and crawl testing

```bash
pnpm exec playwright install chromium   # once
pnpm test:e2e                            # needs the dev server on :3000 and seeded data
node scripts/dev-feed-server.mjs 4010   # serves adapter fixtures for local crawls
pnpm exec tsx --env-file=.env scripts/sync-once.ts <landlord-slug|source-id>
```

The e2e suite mutates data (publishes a home, approves an application). Run
`pnpm db:reset` afterwards to get back to the seed.

See `docs/STATUS.md` for what is built and `docs/TODO.md` for the ordered list of remaining work.
