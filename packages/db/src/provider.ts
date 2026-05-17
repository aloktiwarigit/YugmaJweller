import { Pool, type PoolConfig } from 'pg';
import { logger } from '@goldsmith/observability';

export const POISON_UUID = '00000000-0000-0000-0000-000000000000';

export function createPool(config: PoolConfig): Pool {
  const pool = new Pool({
    max: Number(process.env['PG_POOL_MAX'] ?? '10'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...config,
  });

  pool.on('connect', (client) => {
    // Parameter-bound — defence in depth against any future change to POISON_UUID
    // and consistent with the wider GUC-setting pattern (tx.ts, auth.repository.ts).
    client
      .query('SELECT set_config($1, $2, false)', ['app.current_shop_id', POISON_UUID])
      .catch((err) => {
        logger.error({ err }, 'failed to set poison default on new client');
      });
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'unexpected pg pool error');
  });

  return pool;
}
