import type { Pool } from 'pg';

export interface FixtureTenant {
  id: string;
  slug: string;
  displayName: string;
  seed: (pool: Pool, id: string) => Promise<void>;
}

const tenants: FixtureTenant[] = [];
export const fixtureRegistry = {
  add(t: FixtureTenant): void { tenants.push(t); },
  list(): FixtureTenant[] { return [...tenants]; },
  clear(): void { tenants.length = 0; },
};
