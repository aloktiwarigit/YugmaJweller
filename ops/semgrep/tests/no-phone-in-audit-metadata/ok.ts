import type { Pool } from 'pg';
declare const pool: Pool;

// ok: no phone in metadata — use dedicated phoneE164 param at call site
auditLog(pool, { action: 'otp_request', actorId: 'anon', shopId: 'shop-1' });
