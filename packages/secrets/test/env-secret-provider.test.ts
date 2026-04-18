import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvSecretProvider } from '../src/env-secret-provider';

describe('EnvSecretProvider', () => {
  beforeEach(() => { process.env['TEST_SECRET'] = 'hello'; });
  afterEach(() => { delete process.env['TEST_SECRET']; });

  it('returns secret from env var', async () => {
    const p = new EnvSecretProvider();
    await expect(p.get('TEST_SECRET')).resolves.toBe('hello');
  });

  it('throws if env var missing', async () => {
    const p = new EnvSecretProvider();
    await expect(p.get('MISSING_SECRET')).rejects.toThrow('secret.not_found: MISSING_SECRET');
  });
});
