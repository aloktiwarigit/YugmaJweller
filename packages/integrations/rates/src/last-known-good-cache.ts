import type { Redis } from '@goldsmith/cache';
import type { PurityRates } from './port';

const REDIS_KEY = 'rates:last_known_good';
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface StoredEntry {
  rates: SerializedRates;
  storedAt: string; // ISO string
}

type PurityKey = keyof PurityRates;

type SerializedRates = {
  [K in PurityKey]: { perGramPaise: string; fetchedAt: string };
};

export interface CachedRates {
  rates: PurityRates;
  stale: boolean;
  storedAt: Date;
}

function serialize(rates: PurityRates): SerializedRates {
  const keys = Object.keys(rates) as PurityKey[];
  const result = {} as SerializedRates;
  for (const k of keys) {
    result[k] = {
      perGramPaise: rates[k].perGramPaise.toString(),
      fetchedAt: rates[k].fetchedAt.toISOString(),
    };
  }
  return result;
}

function deserialize(serialized: SerializedRates): PurityRates {
  const keys = Object.keys(serialized) as PurityKey[];
  const result = {} as PurityRates;
  for (const k of keys) {
    result[k] = {
      perGramPaise: BigInt(serialized[k].perGramPaise),
      fetchedAt: new Date(serialized[k].fetchedAt),
    };
  }
  return result;
}

export class LastKnownGoodCache {
  constructor(private readonly redis: Redis) {}

  async update(rates: PurityRates): Promise<void> {
    const entry: StoredEntry = {
      rates: serialize(rates),
      storedAt: new Date().toISOString(),
    };
    await this.redis.set(REDIS_KEY, JSON.stringify(entry), 'EX', 24 * 60 * 60);
  }

  async get(): Promise<CachedRates | null> {
    try {
      const raw = await this.redis.get(REDIS_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw) as StoredEntry;
      const storedAt = new Date(entry.storedAt);
      const ageMs = Date.now() - storedAt.getTime();
      return {
        rates: deserialize(entry.rates),
        stale: ageMs > STALE_THRESHOLD_MS,
        storedAt,
      };
    } catch {
      return null;
    }
  }
}
