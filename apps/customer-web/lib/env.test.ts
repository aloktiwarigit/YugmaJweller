import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateEnv, assertEnv } from './env';

const PROD_ENV = { NODE_ENV: 'production' };

const VALID_PROD_ENV = {
  NODE_ENV: 'production',
  API_URL: 'https://api.example.com',
  NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
  NEXT_PUBLIC_API_BASE: 'https://api.example.com',
  NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'public-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'shop.example.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'goldsmith-prod',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateEnv', () => {
  it('passes in development regardless of missing vars', () => {
    const result = validateEnv({ NODE_ENV: 'development' });
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('fails in production when required vars are absent', () => {
    const result = validateEnv(PROD_ENV);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('API_URL');
    expect(result.missing).toContain('NEXT_PUBLIC_SHOP_SLUG');
    expect(result.missing).toContain('NEXT_PUBLIC_API_BASE');
    expect(result.missing).toContain('NEXT_PUBLIC_SITE_URL');
    expect(result.missing).toContain('NEXT_PUBLIC_FIREBASE_API_KEY');
    expect(result.missing).toContain('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
    expect(result.missing).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  });

  it('passes in production when all required vars are present', () => {
    const result = validateEnv(VALID_PROD_ENV);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('BLOCKS production builds when NEXT_PUBLIC_API_BASE contains localhost', () => {
    const result = validateEnv({
      ...VALID_PROD_ENV,
      NEXT_PUBLIC_API_BASE: 'http://localhost:3001',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /NEXT_PUBLIC_API_BASE.*localhost/.test(e))).toBe(true);
  });

  it('BLOCKS production builds when NEXT_PUBLIC_SITE_URL contains localhost', () => {
    const result = validateEnv({
      ...VALID_PROD_ENV,
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /NEXT_PUBLIC_SITE_URL.*localhost/.test(e))).toBe(true);
  });

  it('fails when admin Firebase vars are absent in production', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      API_URL: 'https://api.example.com',
      NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
    });
    expect(result.ok).toBe(false);
    expect(result.missing.some((key) => key.includes('NEXT_PUBLIC_FIREBASE'))).toBe(true);
  });

  it('BLOCKS production builds when any required URL is not https', () => {
    const result = validateEnv({
      ...VALID_PROD_ENV,
      API_URL: 'http://api.example.com',
      NEXT_PUBLIC_API_BASE: 'http://api.example.com',
      NEXT_PUBLIC_SITE_URL: 'http://shop.example.com',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /API_URL.*https/.test(e))).toBe(true);
    expect(result.errors.some((e) => /NEXT_PUBLIC_API_BASE.*https/.test(e))).toBe(true);
    expect(result.errors.some((e) => /NEXT_PUBLIC_SITE_URL.*https/.test(e))).toBe(true);
  });

  it('BLOCKS production builds when shop slug contains invalid characters', () => {
    const result = validateEnv({
      ...VALID_PROD_ENV,
      NEXT_PUBLIC_SHOP_SLUG: 'Anchor Prod!',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /lowercase letters/.test(e))).toBe(true);
  });
});

describe('assertEnv', () => {
  it('throws when required vars are missing in production', () => {
    expect(() => assertEnv(PROD_ENV)).toThrow(/missing API_URL/);
  });

  it('throws when a required URL contains localhost in production', () => {
    expect(() => assertEnv({
      ...VALID_PROD_ENV,
      NEXT_PUBLIC_API_BASE: 'http://localhost:3001',
    })).toThrow(/localhost/);
  });

  it('throws when a required URL is not https in production', () => {
    expect(() => assertEnv({
      ...VALID_PROD_ENV,
      NEXT_PUBLIC_SITE_URL: 'http://shop.example.com',
    })).toThrow(/https/);
  });

  it('does NOT throw in development', () => {
    expect(() => assertEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('does NOT throw when all required production vars are set correctly', () => {
    expect(() => assertEnv(VALID_PROD_ENV)).not.toThrow();
  });

  it('SKIP_ENV_VALIDATION=1 bypasses validation locally', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => assertEnv({
      NODE_ENV:            'production',
      SKIP_ENV_VALIDATION: '1',
    })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SKIP_ENV_VALIDATION/));
    warn.mockRestore();
  });

  it('SKIP_ENV_VALIDATION=1 is REJECTED in CI', () => {
    expect(() => assertEnv({
      NODE_ENV:            'production',
      SKIP_ENV_VALIDATION: '1',
      CI:                  'true',
    })).toThrow(/forbidden in CI/);
  });
});
