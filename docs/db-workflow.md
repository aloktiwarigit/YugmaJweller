# DB Workflow (E2-S1)

## Roles
- `app_user` — NOSUPERUSER NOBYPASSRLS; DML on tenant tables via `withTenantTx`. Used by `apps/api` + (future) BullMQ workers.
- `migrator` — NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault (Infrastructure Story), scoped to GitHub OIDC role.
- `platform_admin` — owns SECURITY DEFINER cross-tenant reads; used from admin console (Story 1.5+).

## DDL vs DML flow
DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`. DML happens through `withTenantTx(pool, fn)` (never direct `pool.query`) under `app_user`. `app_user` cannot run DDL; `migrator` cannot run DML on tenant tables.

## Adding a new table
1. Add a file under `packages/db/src/schema/` using `tenantScopedTable` or `platformGlobalTable`.
2. Run `pnpm -F @goldsmith/db run db:assert-marked` — passes if marker used.
3. Run `pnpm -F @goldsmith/db exec tsx src/codegen/generate-rls.ts` — emits RLS SQL.
4. Create a new migration `NNNN_<name>.sql` (next number) with table DDL + the emitted RLS block.
5. Add a `GRANT ... ON <new_table> TO app_user` in the same migration.
6. Add a harness fixture entry in `packages/testing/tenant-isolation/fixtures/*` so the 3-tenant test exercises the new table.

## Post-migrate data migrations
Backfills/transforms run as a per-tenant job using `app_user` + `withTenantTx`. MVP: run via a `tsx` script iterating tenants. Post-MVP (when BullMQ is added): use BullMQ worker pattern. Do NOT put backfills in `.sql` files.

## Running locally
```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres
pnpm install
pnpm db:reset
pnpm test
pnpm test:tenant-isolation
```

Redis + LocalStack containers are defined in docker-compose.dev.yml but deferred per ADR-0015 — start them only when needed.
