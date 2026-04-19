// This file simulates a non-auth, non-tenant-boot module calling platformAuditLog.
// The include path filter (apps/api/src/modules/**) and exclude for auth/tenant-boot
// means a file at apps/api/src/modules/catalog/catalog.service.ts would match.
// Fixture: place this content in apps/api/src/modules/catalog to trigger.
import type { Pool } from 'pg';
declare const pool: Pool;
declare const shopId: string;

// ruleid: goldsmith.platform-audit-skip-tenant-only
platformAuditLog(pool, { action: 'catalog_update', shopId });
