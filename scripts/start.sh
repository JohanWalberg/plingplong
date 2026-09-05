#!/usr/bin/env bash
# Starts everything needed for local development: Postgres (Docker), the
# Next.js dev server and the crawler worker. Ctrl+C stops the web and worker
# processes; the database container keeps running (stop it with `pnpm db:down`).
#
# Usage: pnpm start:all            # starts all
#        pnpm start:all --reset    # also resets and reseeds the database first
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "created .env from .env.example"
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Starting Docker Desktop…"
  open -a Docker 2>/dev/null || true
  until docker info >/dev/null 2>&1; do sleep 2; done
fi

docker compose up -d db
echo "waiting for postgres…"
until docker compose exec -T db pg_isready -U hyrabostad >/dev/null 2>&1; do sleep 1; done

if [ "${1:-}" = "--reset" ]; then
  pnpm db:reset
else
  pnpm db:migrate
  # Seed if the database is empty.
  if [ "$(docker compose exec -T db psql -U hyrabostad -Atc "select count(*) from municipality")" = "0" ]; then
    pnpm db:seed
  fi
fi

cleanup() {
  echo; echo "stopping web and worker…"
  kill "${WEB_PID:-}" "${WORKER_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

pnpm dev &
WEB_PID=$!
pnpm worker &
WORKER_PID=$!

echo
echo "web:    http://localhost:3000/sv   (portal: /sv/portal/logga-in, admin: /sv/admin/logga-in)"
echo "worker: running (pg-boss)"
echo "logins: see README.md — password hyrabostad-dev-1234"
echo "Ctrl+C to stop."
wait
