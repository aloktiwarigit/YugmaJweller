import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

// ---------------------------------------------------------------------------
// Pool helpers
// ---------------------------------------------------------------------------

function makeHealthyPool() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  };
}

function makeUnreachablePool() {
  return {
    connect: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  };
}

function makeQueryFailPool() {
  const client = {
    query: vi.fn().mockRejectedValue(new Error('relation does not exist')),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  describe('GET /healthz (shallow — no DB)', () => {
    it('returns { status: "ok" } immediately', () => {
      const ctrl = new HealthController(makeHealthyPool() as never);
      expect(ctrl.healthz()).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health (deep — DB check)', () => {
    let healthyPool: ReturnType<typeof makeHealthyPool>;

    beforeEach(() => {
      healthyPool = makeHealthyPool();
    });

    it('returns { status: "ok", db: "ok" } when pool is healthy', async () => {
      const ctrl = new HealthController(healthyPool as never);
      const result = await ctrl.health();
      expect(result).toEqual({ status: 'ok', db: 'ok' });
    });

    it('releases the pool client after a successful query', async () => {
      const ctrl = new HealthController(healthyPool as never);
      await ctrl.health();
      expect(healthyPool._client.release).toHaveBeenCalledOnce();
    });

    it('throws ServiceUnavailableException (503) when pool.connect() rejects', async () => {
      const ctrl = new HealthController(makeUnreachablePool() as never);
      await expect(ctrl.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException (503) when SELECT 1 fails and still releases client', async () => {
      const failPool = makeQueryFailPool();
      const ctrl = new HealthController(failPool as never);
      await expect(ctrl.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
      // client.release() must be called via finally block even on query error
      expect(failPool._client.release).toHaveBeenCalledOnce();
    });

    it('503 response body contains { status: "error", db: "unreachable" }', async () => {
      const ctrl = new HealthController(makeUnreachablePool() as never);
      try {
        await ctrl.health();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const ex = err as ServiceUnavailableException;
        expect(ex.getResponse()).toMatchObject({ status: 'error', db: 'unreachable' });
      }
    });
  });
});
