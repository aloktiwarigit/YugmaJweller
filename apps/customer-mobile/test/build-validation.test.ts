/**
 * Unit tests for production build validation guards.
 *
 * These tests verify that the build-time safety checks in
 * src/build-validation.ts catch misconfigured production builds before
 * they reach the store.
 *
 * Guards tested:
 *   1. HTTPS-only API URL in production (non-dev) builds
 *   2. No .dev bundle IDs in production builds
 *   3. Both guards pass for a correctly configured production build
 *   4. Dev builds bypass both guards (EXPO_PUBLIC_DEV_AUTH=1)
 */

import { describe, it, expect } from 'vitest';
import {
  validateProductionBuild,
  assertProductionBuildEnv,
  type BuildEnv,
} from '../src/build-validation';

// A valid production env that should pass all guards.
const validProdEnv: BuildEnv = {
  apiBaseUrl: 'https://api.aanchaljewellers.com',
  devAuth: '0',
  androidPackage: 'com.aanchaljewellers.customer',
  iosBundleId: 'com.aanchaljewellers.customer',
};

// A valid dev env that should bypass all guards.
const devEnv: BuildEnv = {
  apiBaseUrl: 'http://10.0.2.2:3001',
  devAuth: '1',
  androidPackage: 'com.goldsmith.customer.dev',
  iosBundleId: 'com.goldsmith.customer.dev',
};

describe('validateProductionBuild', () => {
  describe('HTTPS guard', () => {
    it('passes when API URL starts with https://', () => {
      const result = validateProductionBuild(validProdEnv);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when API URL starts with http:// in a production build', () => {
      const result = validateProductionBuild({
        ...validProdEnv,
        apiBaseUrl: 'http://api.example.com',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/https:\/\//);
      expect(result.errors[0]).toMatch(/EXPO_PUBLIC_API_BASE_URL/);
    });

    it('fails when API URL is empty in a production build', () => {
      const result = validateProductionBuild({ ...validProdEnv, apiBaseUrl: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/https:\/\//);
    });

    it('fails when API URL is undefined in a production build', () => {
      const result = validateProductionBuild({ ...validProdEnv, apiBaseUrl: undefined });
      expect(result.valid).toBe(false);
    });

    it('bypasses HTTPS guard when devAuth is "1"', () => {
      const result = validateProductionBuild(devEnv);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('No .dev bundle guard', () => {
    it('fails when Android package ends with .dev in a production build', () => {
      const result = validateProductionBuild({
        ...validProdEnv,
        androidPackage: 'com.goldsmith.customer.dev',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('EXPO_PUBLIC_ANDROID_PACKAGE'))).toBe(true);
    });

    it('fails when iOS bundle ID ends with .dev in a production build', () => {
      const result = validateProductionBuild({
        ...validProdEnv,
        iosBundleId: 'com.goldsmith.customer.dev',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('EXPO_PUBLIC_IOS_BUNDLE_ID'))).toBe(true);
    });

    it('accumulates both Android and iOS errors when both are dev bundles', () => {
      const result = validateProductionBuild({
        ...validProdEnv,
        androidPackage: 'com.goldsmith.customer.dev',
        iosBundleId: 'com.goldsmith.customer.dev',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('bypasses .dev bundle guard when devAuth is "1"', () => {
      const result = validateProductionBuild(devEnv);
      expect(result.valid).toBe(true);
    });

    it('passes for tenant-specific package names', () => {
      const result = validateProductionBuild({
        ...validProdEnv,
        androidPackage: 'com.aanchaljewellers.customer',
        iosBundleId: 'com.aanchaljewellers.customer',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('combined guard scenarios', () => {
    it('reports both HTTPS and .dev errors when both fail', () => {
      const result = validateProductionBuild({
        apiBaseUrl: 'http://api.example.com',
        devAuth: '0',
        androidPackage: 'com.goldsmith.customer.dev',
        iosBundleId: 'com.goldsmith.customer.dev',
      });
      expect(result.valid).toBe(false);
      // 1 HTTPS error + 2 .dev errors = 3
      expect(result.errors).toHaveLength(3);
    });

    it('passes a fully valid production env', () => {
      const result = validateProductionBuild(validProdEnv);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});

describe('assertProductionBuildEnv', () => {
  it('does not throw for a valid production env', () => {
    expect(() => assertProductionBuildEnv(validProdEnv)).not.toThrow();
  });

  it('throws with an actionable message listing all errors', () => {
    expect(() =>
      assertProductionBuildEnv({
        apiBaseUrl: 'http://api.example.com',
        devAuth: '0',
        androidPackage: 'com.goldsmith.customer.dev',
        iosBundleId: 'com.goldsmith.customer.dev',
      }),
    ).toThrow(/Production build validation failed/);
  });

  it('thrown error message references the runbook', () => {
    expect(() =>
      assertProductionBuildEnv({ ...validProdEnv, apiBaseUrl: 'http://bad.example.com' }),
    ).toThrow(/runbook/);
  });

  it('does not throw for a dev env even with http:// and .dev packages', () => {
    expect(() => assertProductionBuildEnv(devEnv)).not.toThrow();
  });
});
