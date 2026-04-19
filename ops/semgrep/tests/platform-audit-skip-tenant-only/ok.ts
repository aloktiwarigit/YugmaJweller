// ok: tenant-scoped event uses auditLog(), not platformAuditLog()
import type { Pool } from 'pg';
declare const pool: Pool;
declare const shopId: string;

auditLog(pool, { action: 'catalog_update', shopId });
