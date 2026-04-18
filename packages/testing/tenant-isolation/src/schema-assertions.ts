import type { Pool } from 'pg';
import { tableRegistry } from '@goldsmith/db';

export interface AssertResult { ok: boolean; failures: string[]; }

export async function assertRlsInvariants(pool: Pool): Promise<AssertResult> {
  const fails: string[] = [];
  const c = await pool.connect();
  try {
    for (const meta of tableRegistry.list()) {
      const q = await c.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
          JOIN pg_namespace n ON n.oid = relnamespace
          WHERE relname = $1 AND n.nspname = 'public'`,
        [meta.name],
      );
      if (q.rowCount === 0) { fails.push(`table ${meta.name} missing`); continue; }
      const { relrowsecurity, relforcerowsecurity } = q.rows[0] as { relrowsecurity: boolean; relforcerowsecurity: boolean };
      if (meta.kind === 'tenant') {
        if (!relrowsecurity) fails.push(`${meta.name}: RLS not enabled (invariant 2)`);
        if (!relforcerowsecurity) fails.push(`${meta.name}: FORCE RLS not set (invariant 2)`);
        const p = await c.query(
          `SELECT polname,
                  pg_get_expr(polqual, polrelid) AS using_expr,
                  pg_get_expr(polwithcheck, polrelid) AS check_expr
             FROM pg_policy
            WHERE polrelid = to_regclass($1)`,
          [meta.name],
        );
        if (p.rowCount === 0) {
          fails.push(`${meta.name}: no policy (invariant 2)`);
        } else {
          const row = p.rows[0] as { using_expr: string | null; check_expr: string | null };
          const usingMatches =
            row.using_expr?.includes('shop_id') &&
            row.using_expr?.includes(`current_setting('app.current_shop_id'`);
          if (!usingMatches) {
            fails.push(
              `${meta.name}: policy USING missing shop_id/current_setting pattern (got: ${row.using_expr ?? 'NULL'}) (invariant 2)`,
            );
          }
          const checkMatches =
            row.check_expr?.includes('shop_id') &&
            row.check_expr?.includes(`current_setting('app.current_shop_id'`);
          if (!checkMatches) {
            fails.push(
              `${meta.name}: policy WITH CHECK missing shop_id/current_setting pattern (got: ${row.check_expr ?? 'NULL'}) (invariant 2)`,
            );
          }
        }
      } else if (meta.kind === 'global') {
        if (relrowsecurity) fails.push(`${meta.name}: RLS enabled on platformGlobalTable (invariant 3)`);
      }
    }

    const app = await c.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='app_user'`);
    if (app.rowCount === 0) fails.push('app_user role missing (invariant 4)');
    else {
      const r = app.rows[0] as { rolbypassrls: boolean; rolsuper: boolean };
      if (r.rolbypassrls) fails.push('app_user has BYPASSRLS (invariant 4)');
      if (r.rolsuper) fails.push('app_user has SUPERUSER (invariant 4)');
    }

    const migratorDml = await c.query(
      `SELECT table_name, privilege_type FROM information_schema.table_privileges
        WHERE grantee='migrator' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
          AND table_schema='public'`,
    );
    for (const row of migratorDml.rows as Array<{ table_name: string; privilege_type: string }>) {
      const meta = tableRegistry.get(row.table_name);
      if (meta?.kind === 'tenant') {
        fails.push(`migrator has ${row.privilege_type} on tenant table ${row.table_name} (invariant 5)`);
      }
    }

    const auditGrants = await c.query(
      `SELECT privilege_type FROM information_schema.table_privileges
        WHERE grantee='app_user' AND table_name='audit_events'`,
    );
    const types = new Set(auditGrants.rows.map((r: { privilege_type: string }) => r.privilege_type));
    if (!types.has('INSERT')) fails.push('app_user lacks INSERT on audit_events (invariant 11)');
    if (types.has('UPDATE')) fails.push('app_user has UPDATE on audit_events (invariant 11)');
    if (types.has('DELETE')) fails.push('app_user has DELETE on audit_events (invariant 11)');
  } finally {
    c.release();
  }
  return { ok: fails.length === 0, failures: fails };
}
