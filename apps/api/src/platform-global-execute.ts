import type { Pool, PoolClient } from 'pg';

export async function platformGlobalExecute<T>(
  reviewReason: string,
  fn: () => Promise<T>,
): Promise<T> {
  void reviewReason;
  return fn();
}

export async function platformGlobalTx<T>(
  pool: Pool,
  reviewReason: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return platformGlobalExecute(reviewReason, async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      try {
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      }
    } finally {
      client.release();
    }
  });
}
