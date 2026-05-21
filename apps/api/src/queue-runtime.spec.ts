import { afterEach, describe, expect, it } from 'vitest';
import { areQueueWorkersEnabled } from './queue-runtime';

const originalNodeEnv = process.env['NODE_ENV'];
const originalFlag = process.env['BULLMQ_WORKERS_ENABLED'];

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = originalNodeEnv;
  }

  if (originalFlag === undefined) {
    delete process.env['BULLMQ_WORKERS_ENABLED'];
  } else {
    process.env['BULLMQ_WORKERS_ENABLED'] = originalFlag;
  }
});

describe('areQueueWorkersEnabled', () => {
  it('disables queue workers by default in production API containers', () => {
    delete process.env['BULLMQ_WORKERS_ENABLED'];
    process.env['NODE_ENV'] = 'production';

    expect(areQueueWorkersEnabled()).toBe(false);
  });

  it('allows an explicit worker runtime opt-in', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['BULLMQ_WORKERS_ENABLED'] = '1';

    expect(areQueueWorkersEnabled()).toBe(true);
  });

  it('keeps local and test workers enabled unless explicitly disabled', () => {
    delete process.env['BULLMQ_WORKERS_ENABLED'];
    process.env['NODE_ENV'] = 'test';

    expect(areQueueWorkersEnabled()).toBe(true);
  });
});
