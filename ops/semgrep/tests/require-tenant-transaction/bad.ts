import { pool } from '@goldsmith/db';
export async function bad() {
  return pool.query('SELECT * FROM shop_users');
}
