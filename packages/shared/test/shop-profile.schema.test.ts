import { describe, it, expect } from 'vitest';
import { PatchShopProfileSchema } from '../src/schemas/shop-profile.schema';

describe('PatchShopProfileSchema', () => {
  it('accepts a valid name-only patch', () => {
    const result = PatchShopProfileSchema.safeParse({ name: 'Rajesh Jewellers & Sons' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch (no-op)', () => {
    const result = PatchShopProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an invalid GSTIN', () => {
    const result = PatchShopProfileSchema.safeParse({ gstin: 'INVALID' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('GSTIN_INVALID');
    }
  });

  it('accepts a valid GSTIN', () => {
    const result = PatchShopProfileSchema.safeParse({ gstin: '09AAACR5055K1Z5' });
    expect(result.success).toBe(true);
  });

  it('rejects about_text exceeding 500 chars', () => {
    const result = PatchShopProfileSchema.safeParse({ about_text: 'x'.repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('ABOUT_TOO_LONG');
    }
  });

  it('rejects an invalid PIN code', () => {
    const result = PatchShopProfileSchema.safeParse({ address: { street: 'A', city: 'B', state: 'UP', pin_code: '12345' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('PIN_INVALID');
    }
  });

  it('rejects unknown fields (strict)', () => {
    const result = PatchShopProfileSchema.safeParse({ unknownField: 'x' });
    expect(result.success).toBe(false);
  });

  it('accepts null for nullable fields', () => {
    const result = PatchShopProfileSchema.safeParse({ gstin: null, logo_url: null });
    expect(result.success).toBe(true);
  });

  it('rejects a name that is empty string', () => {
    const result = PatchShopProfileSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('NAME_REQUIRED');
    }
  });

  it('accepts valid operating hours', () => {
    const hours = {
      mon: { enabled: true, open: '10:00', close: '20:00' },
      tue: { enabled: true, open: '10:00', close: '20:00' },
      wed: { enabled: true, open: '10:00', close: '20:00' },
      thu: { enabled: true, open: '10:00', close: '20:00' },
      fri: { enabled: true, open: '10:00', close: '20:00' },
      sat: { enabled: true, open: '10:00', close: '18:00' },
      sun: { enabled: false, open: null, close: null },
    };
    const result = PatchShopProfileSchema.safeParse({ operating_hours: hours });
    expect(result.success).toBe(true);
  });

  it('rejects enabled day with null open time (HOURS_REQUIRED_WHEN_ENABLED)', () => {
    const hours = {
      mon: { enabled: true, open: null, close: '20:00' },
      tue: { enabled: true, open: '10:00', close: '20:00' },
      wed: { enabled: true, open: '10:00', close: '20:00' },
      thu: { enabled: true, open: '10:00', close: '20:00' },
      fri: { enabled: true, open: '10:00', close: '20:00' },
      sat: { enabled: true, open: '10:00', close: '18:00' },
      sun: { enabled: false, open: null, close: null },
    };
    const result = PatchShopProfileSchema.safeParse({ operating_hours: hours });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('HOURS_REQUIRED_WHEN_ENABLED');
    }
  });

  it('rejects invalid time value (25:00) with TIME_INVALID', () => {
    const hours = {
      mon: { enabled: true, open: '25:00', close: '20:00' },
      tue: { enabled: true, open: '10:00', close: '20:00' },
      wed: { enabled: true, open: '10:00', close: '20:00' },
      thu: { enabled: true, open: '10:00', close: '20:00' },
      fri: { enabled: true, open: '10:00', close: '20:00' },
      sat: { enabled: true, open: '10:00', close: '18:00' },
      sun: { enabled: false, open: null, close: null },
    };
    const result = PatchShopProfileSchema.safeParse({ operating_hours: hours });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('TIME_INVALID');
    }
  });
});
