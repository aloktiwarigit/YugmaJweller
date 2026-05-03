# DB Workflow (E2-S1)

## Roles

- `app_user` - NOSUPERUSER NOBYPASSRLS; tenant DML through `withTenantTx(pool, fn)` for request-scoped code or `withShopTx(pool, shopId, fn)` for public/webhook/job code that has an explicit reviewed shop id.
- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
- `platform_admin` - owns SECURITY DEFINER cross-tenant reads; used from the platform admin console.

## DDL vs DML Flow

DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.

Tenant DML must use one of the reviewed transaction helpers:

- `withTenantTx(pool, fn)` when a request `TenantContext` is already established.
- `withShopTx(pool, shopId, fn)` when the code path is public, webhook-driven, or job-driven and has an explicit trusted shop id.

Do not use direct `pool.query` / `pool.connect` for tenant DML. The Semgrep
ERROR gate enforces this boundary.

Platform-global DML is exceptional. Cross-tenant platform-admin code must use
`platformGlobalExecute(reason, fn)` or `platformGlobalTx(pool, reason, fn)`, with
the reason documenting why tenant scoping is intentionally not used. These
helpers are reviewed allow-list entries in the tenant-transaction Semgrep rule.

`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.

## Adding A New Table

1. Add a file under `packages/db/src/schema/` using `tenantScopedTable` or `platformGlobalTable`.
2. Run `pnpm -F @goldsmith/db run db:assert-marked`; it passes if the marker is used.
3. Run `pnpm -F @goldsmith/db exec tsx src/codegen/generate-rls.ts`; it emits RLS SQL.
4. Create a new migration `NNNN_<name>.sql` with table DDL plus the emitted RLS block.
5. Add the required `GRANT ... ON <new_table> TO app_user` in the same migration.
6. Add a harness fixture entry in `packages/testing/tenant-isolation/fixtures/*` so the 3-tenant test exercises the new table.

## Post-Migrate Data Migrations

Backfills and transforms run as per-tenant jobs using `app_user` plus
`withShopTx` or `withTenantTx`. MVP scripts can iterate tenants with `tsx`.
Do not put data backfills in `.sql` files unless the operation is truly
schema-coupled and reviewed as part of a migration.

## Running Locally

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
pnpm install
pnpm db:reset
pnpm test
pnpm test:tenant-isolation
```

Redis and LocalStack containers are defined in `docker-compose.dev.yml`; start
them only when the test or feature path needs them.
