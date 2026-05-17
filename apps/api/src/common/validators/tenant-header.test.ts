import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertPublicTenantHeader, isUuidShape } from './tenant-header';

describe('assertPublicTenantHeader', () => {
  const VALID = '11111111-1111-1111-1111-111111111111';

  it('accepts a well-formed UUID and returns it unchanged', () => {
    expect(assertPublicTenantHeader(VALID)).toBe(VALID);
  });

  it('accepts uppercase hex', () => {
    expect(assertPublicTenantHeader(VALID.toUpperCase())).toBe(VALID.toUpperCase());
  });

  it('rejects undefined with tenant_id_required', () => {
    let captured: unknown;
    try {
      assertPublicTenantHeader(undefined);
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(BadRequestException);
    expect((captured as BadRequestException).getResponse()).toMatchObject({
      code: 'catalog.tenant_id_required',
    });
  });

  it('rejects empty string with tenant_id_required', () => {
    expect(() => assertPublicTenantHeader('')).toThrow(BadRequestException);
  });

  it('rejects a non-UUID string with tenant_id_invalid', () => {
    let captured: unknown;
    try {
      assertPublicTenantHeader('not-a-uuid');
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(BadRequestException);
    expect((captured as BadRequestException).getResponse()).toMatchObject({
      code: 'catalog.tenant_id_invalid',
    });
  });

  it('rejects a SQL-injection payload masquerading as a UUID', () => {
    // The pre-fix sink: `SET LOCAL app.current_shop_id = '${shopId}'` would
    // execute the injected pg_sleep statement under simple query protocol.
    const malicious = `${VALID}'; SELECT pg_sleep(10); --`;
    expect(() => assertPublicTenantHeader(malicious)).toThrow(BadRequestException);
  });

  it('rejects whitespace-padded UUID (strict shape)', () => {
    expect(() => assertPublicTenantHeader(` ${VALID} `)).toThrow(BadRequestException);
  });

  it('rejects UUID with trailing garbage', () => {
    expect(() => assertPublicTenantHeader(`${VALID}AAAA`)).toThrow(BadRequestException);
  });
});

describe('isUuidShape', () => {
  const VALID = '22222222-2222-2222-2222-222222222222';

  it('returns true for valid UUID', () => {
    expect(isUuidShape(VALID)).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isUuidShape(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUuidShape('')).toBe(false);
  });

  it('returns false for SQL-injection payload', () => {
    expect(isUuidShape(`${VALID}'; DROP TABLE users; --`)).toBe(false);
  });
});
