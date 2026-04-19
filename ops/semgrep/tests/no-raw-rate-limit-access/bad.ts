import type { Pool } from 'pg';
declare const pool: Pool;
declare const phone: string;

// ruleid: goldsmith.no-raw-rate-limit-access
await pool.query(`SELECT * FROM auth_rate_limits WHERE phone = $1`, [phone]);
