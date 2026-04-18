#!/usr/bin/env bash
# Usage: tenant-delete.sh --tenant <uuid> --confirm
# MVP scope: deletes DB rows + generates placeholder DPDPA certificate.
# Redis flush deferred (no Redis in MVP per ADR-0015). Azure Key Vault deletion deferred.
set -euo pipefail

TENANT_ID=""; CONFIRM=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)  TENANT_ID="$2"; shift 2 ;;
    --confirm) CONFIRM=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
[[ $CONFIRM -ne 1 ]] && { echo "--confirm required (MFA + multi-person approval in prod)" >&2; exit 2; }

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ deleting tenant rows from every tenantScopedTable ..."
DATABASE_URL="$DB_URL" TENANT_ID="$TENANT_ID" \
pnpm --config.engine-strict=false -F @goldsmith/db exec tsx -e "
import { createPool, tableRegistry } from '@goldsmith/db';
const pool = createPool({ connectionString: process.env.DATABASE_URL });
const tenantId = process.env.TENANT_ID;
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET ROLE platform_admin');
    for (const m of tableRegistry.list().filter((x) => x.kind === 'tenant')) {
      await c.query(\`DELETE FROM \${m.name} WHERE shop_id=\$1\`, [tenantId]);
    }
    await c.query('DELETE FROM shops WHERE id=\$1', [tenantId]);
    await c.query('RESET ROLE');
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); await pool.end(); }
})().catch((e) => { console.error(e); process.exit(1); });
"

echo "→ flushing tenant cache keys ..."
echo "  (MVP: no Redis — skipped per ADR-0015. Redis flush will land with Infrastructure Story.)"

echo "→ scheduling KEK deletion ..."
echo "  (MVP: LocalKMS in-memory — deleted on process exit. Azure Key Vault ScheduleKeyDeletion lands with Infrastructure Story.)"

echo "→ generating DPDPA erasure certificate ..."
CERT_TXT="certs/dpdpa-erasure-$TENANT_ID-$(date -u +%Y%m%dT%H%M%SZ).txt"
mkdir -p certs
cat > "$CERT_TXT" <<CERT
DPDPA Erasure Certificate — PLACEHOLDER (MVP)

Tenant ID: $TENANT_ID
Erasure completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Method: Logical deletion of all tenant-scoped rows in Goldsmith Postgres.
Residual: Per ADR-0014, non-encrypted columns may be restorable from PITR
backups for up to 7 calendar days via restricted break-glass procedure.

Signed: (placeholder — full PDF certificate issued in Story 1.5 when
platform-admin console + DPO sign-off flow lands)
CERT

echo "✓ tenant $TENANT_ID deleted; certificate at $CERT_TXT"
