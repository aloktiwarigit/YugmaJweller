import { Redis } from '@goldsmith/cache';
import { logger } from '@goldsmith/observability';

type ManagedRedisOptions = {
  lazyConnect?: boolean;
  enableReadyCheck?: boolean;
  connectTimeout?: number;
  maxRetriesPerRequest?: number | null;
  retryStrategy?: (times: number) => number | null;
};

export function createRedisClient(name: string, options: ManagedRedisOptions = {}): Redis {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    lazyConnect: true,
    enableReadyCheck: false,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: isProduction ? () => null : (times: number) => Math.min(times * 200, 5000),
    ...options,
  });

  redis.on('error', (err: Error) => {
    logger.warn({ err, redisClient: name }, 'redis.client_error');
  });

  return redis;
}
