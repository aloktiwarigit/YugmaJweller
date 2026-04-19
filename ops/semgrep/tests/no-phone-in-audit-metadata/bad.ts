import type { Pool } from 'pg';
declare const pool: Pool;
declare const userPhone: string;

// ruleid: goldsmith.no-phone-in-audit-metadata
auditLog(pool, { action: 'otp_request', metadata: { phone: userPhone } });
