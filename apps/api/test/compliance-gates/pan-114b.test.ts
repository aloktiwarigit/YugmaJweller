import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { enforcePanRequired, ComplianceHardBlockError, PAN_THRESHOLD_PAISE } from '@goldsmith/compliance';
import { encryptColumn, decryptColumn, serializeEnvelope, deserializeEnvelope, LocalKMS } from '@goldsmith/crypto-envelope';

/**
 * PAN Rule 114B compliance gate.
 * Static-analysis block: verifies billing service source never removes the gate.
 * Unit block: threshold boundary, encryption round-trip, tenant isolation.
 */
describe('PAN Rule 114B — billing service static checks', () => {
  const svcSrc = readFileSync(
    resolve(__dirname, '../../src/modules/billing/billing.service.ts'),
    'utf8',
  );

  it('imports enforcePanRequired from @goldsmith/compliance', () => {
    expect(svcSrc).toMatch(
      /import\s*\{[^}]*enforcePanRequired[^}]*\}\s*from\s*['"]@goldsmith\/compliance['"]/,
    );
  });

  it('calls enforcePanRequired before insertInvoice (hard-block fires before DB write)', () => {
    const idxEnforce = svcSrc.indexOf('enforcePanRequired(');
    const idxInsert  = svcSrc.indexOf('this.repo.insertInvoice(');
    expect(idxEnforce).toBeGreaterThan(-1);
    expect(idxInsert).toBeGreaterThan(-1);
    expect(idxEnforce).toBeLessThan(idxInsert);
  });

  it('imports encryptColumn from @goldsmith/crypto-envelope (PAN encrypted at app layer)', () => {
    expect(svcSrc).toMatch(
      /import\s*\{[^}]*encryptColumn[^}]*\}\s*from\s*['"]@goldsmith\/crypto-envelope['"]/,
    );
  });

  it('does NOT log PAN plaintext in audit (no bare `pan: normalizedPan`)', () => {
    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/gs)].map((m) => m[0]);
    for (const block of auditAfterBlocks) {
      expect(block).not.toMatch(/\bpan:\s*normalized/);
      expect(block).not.toMatch(/\bpan:\s*dto\.pan/);
    }
  });

  it('does NOT include pan_ciphertext inside any audit `after:` object literal', () => {
    // Extract each `after: { ... }` block (single-line) and verify none contain pan_ciphertext.
    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/g)].map((m) => m[0]);
    for (const block of auditAfterBlocks) {
      expect(block).not.toMatch(/pan_ciphertext/i);
    }
  });

  it('normalizes PAN before encryption (normalizePan called)', () => {
    expect(svcSrc).toMatch(/normalizePan\(/);
  });

  it('validates PAN format before encryption (validatePanFormat called)', () => {
    expect(svcSrc).toMatch(/validatePanFormat\(/);
  });

  it('uses per-tenant KEK from shops table (getShopKekArn called)', () => {
    expect(svcSrc).toMatch(/getShopKekArn\(/);
  });

  it('encrypts Form60 data before DB write (serializeEnvelope used)', () => {
    const idxForm60Encrypt = svcSrc.indexOf('form60Encrypted = serializeEnvelope');
    const idxInsert        = svcSrc.indexOf('this.repo.insertInvoice(');
    expect(idxForm60Encrypt).toBeGreaterThan(-1);
    expect(idxForm60Encrypt).toBeLessThan(idxInsert);
  });
});

describe('PAN Rule 114B — threshold boundary', () => {
  it('PAN_THRESHOLD_PAISE is exactly Rs 2,00,000 in paise (20_000_000n)', () => {
    expect(PAN_THRESHOLD_PAISE).toBe(20_000_000n);
  });

  it('Rs 1,99,999 (19_999_900n paise) — no block without PAN', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 19_999_900n, pan: null, form60Data: null }),
    ).not.toThrow();
  });

  it('Rs 2,00,000 (20_000_000n paise) — blocks without PAN', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_000n, pan: null, form60Data: null }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('Rs 2,00,001 (20_000_100n paise) — blocks without PAN', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_100n, pan: null, form60Data: null }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('Rs 2,00,001 — passes with valid PAN', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_100n, pan: 'ABCDE1234F', form60Data: null }),
    ).not.toThrow();
  });

  it('Rs 2,00,001 — passes with Form60', () => {
    expect(() =>
      enforcePanRequired({
        totalPaise:  20_000_100n,
        pan:         null,
        form60Data:  { name: 'Ram', address: 'Ayodhya UP', reasonForNoPan: 'no card', estimatedAnnualIncomePaise: '0' },
      }),
    ).not.toThrow();
  });
});

describe('PAN Rule 114B — encryption round-trip + tenant isolation', () => {
  it('PAN encrypt → serialize → deserialize → decrypt returns original', async () => {
    const kms    = new LocalKMS();
    const keyArn = await kms.createKeyForTenant('shop-test');
    const pan    = 'ABCDE1234F';
    const env    = await encryptColumn(kms, keyArn, pan);
    const buf    = serializeEnvelope(env);
    const deser  = deserializeEnvelope(buf, keyArn);
    const plain  = await decryptColumn(kms, deser);
    expect(plain).toBe(pan);
  });

  it('PAN never appears in serialized bytes as plaintext UTF-8', async () => {
    const kms    = new LocalKMS();
    const keyArn = await kms.createKeyForTenant('shop-test-2');
    const pan    = 'ABCDE1234F';
    const env    = await encryptColumn(kms, keyArn, pan);
    const buf    = serializeEnvelope(env);
    expect(buf.toString('utf8')).not.toContain(pan);
  });

  it('Tenant A key cannot decrypt Tenant B ciphertext (per-tenant isolation)', async () => {
    const kms  = new LocalKMS();
    const arnA = await kms.createKeyForTenant('tenant-a');
    const arnB = await kms.createKeyForTenant('tenant-b');
    const env  = await encryptColumn(kms, arnA, 'ABCDE1234F');
    const buf  = serializeEnvelope(env);
    const wrongDeser = deserializeEnvelope(buf, arnB);
    await expect(decryptColumn(kms, wrongDeser)).rejects.toThrow();
  });
});
