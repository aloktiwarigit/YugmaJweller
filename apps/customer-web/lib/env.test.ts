import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

const PROD_ENV = { NODE_ENV: 'production' };

describe('validateEnv', () => {
  it('passes in development regardless of missing vars', () => {
    const result = validateEnv({ NODE_ENV: 'development' });
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('fails in production when required vars are absent', () => {
    const result = validateEnv(PROD_ENV);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('NEXT_PUBLIC_SHOP_SLUG');
    expect(result.missing).toContain('NEXT_PUBLIC_API_BASE');
    expect(result.missing).toContain('NEXT_PUBLIC_SITE_URL');
  });

  it('passes in production when all required vars are present', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('warns when production values contain localhost sentinel', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
      NEXT_PUBLIC_API_BASE: 'http://localhost:3001',
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
    });
    expect(result.warnings.some((w) => w.includes('localhost'))).toBe(true);
  });

  it('warns when admin Firebase vars are absent in production', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
    });
    expect(result.warnings.some((w) => w.includes('NEXT_PUBLIC_FIREBASE'))).toBe(true);
  });

  it('is ok=true even with warnings (warnings do not block build)', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SHOP_SLUG: 'anchor-prod',
      NEXT_PUBLIC_API_BASE: 'http://localhost:3001',
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
