import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { logger } from '@goldsmith/observability';

export async function runMigrations(pool: Pool, dir: string): Promise<void> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS __migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    for (const f of files) {
      const applied = await c.query('SELECT 1 FROM __migrations WHERE filename=$1', [f]);
      if (applied.rowCount && applied.rowCount > 0) continue;
      logger.info({ filename: f }, 'applying migration');
      await c.query(readFileSync(join(dir, f), 'utf8'));
      await c.query('INSERT INTO __migrations (filename) VALUES ($1)', [f]);
    }
  } finally {
    c.release();
  }
}

// CLI entry point — Windows-safe argv check
const invoked = process.argv[1] ?? '';
if (invoked.endsWith('migrate.ts') || invoked.endsWith('migrate.js')) {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'))
    .then(() => pool.end())
    .catch((e) => { logger.error({ err: e }, 'migration failed'); process.exit(1); });
}
