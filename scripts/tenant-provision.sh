#!/usr/bin/env bash
# Usage: tenant-provision.sh --tenant <uuid-or-slug> [--slug <slug>] [--display <name>]
# MVP scope: uses LocalKMS (in-memory). Azure Key Vault integration lands in Infrastructure Story.
set -euo pipefail

TENANT_ID=""; SLUG=""; DISPLAY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)  TENANT_ID="$2"; shift 2 ;;
    --slug)    SLUG="$2"; shift 2 ;;
    --display) DISPLAY="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }

# UUID-validate TENANT_ID up front (defense-in-depth even for operator-run scripts)
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
if ! [[ "$TENANT_ID" =~ $UUID_RE ]]; then
  echo "TENANT_ID must be a valid UUID (got: $TENANT_ID)" >&2
  exit 2
fi

SLUG="${SLUG:-$TENANT_ID}"
DISPLAY="${DISPLAY:-$SLUG}"

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ inserting shops row for $TENANT_ID ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -v tenant_id="$TENANT_ID" \
  -v slug="$SLUG" \
  -v display="$DISPLAY" \
  <<'SQL'
INSERT INTO shops (id, slug, display_name, status)
VALUES (:'tenant_id'::uuid, :'slug', :'display', 'PROVISIONING')
ON CONFLICT (id) DO NOTHING;
SQL

echo "→ provisioning LocalKMS KEK (MVP — Azure Key Vault deferred per ADR-0015) ..."
# LocalKMS is per-process in-memory, so this only records a placeholder ARN.
# Real KEK provisioning lands with Azure Key Vault in the Infrastructure Story.
KEK_ARN="local:kms:${TENANT_ID}:placeholder"
psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id="$TENANT_ID" -v kek="$KEK_ARN" \
  -c "UPDATE shops SET kek_key_arn=:'kek', status='ACTIVE' WHERE id=:'tenant_id'::uuid;"

echo "→ running tenant-isolation harness against new tenant ..."
DATABASE_URL="$DB_URL" pnpm -F @goldsmith/testing-tenant-isolation test:tenant-isolation

echo "✓ tenant $TENANT_ID provisioned (KEK $KEK_ARN) and harness-gated"
