#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ dropping + recreating schema public ..."
psql "$DB_URL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
SQL

echo "→ running migrations ..."
DATABASE_URL="$DB_URL" pnpm -F @goldsmith/db exec tsx src/migrate.ts

echo "✓ db reset complete"
