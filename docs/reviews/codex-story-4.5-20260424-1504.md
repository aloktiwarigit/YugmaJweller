OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019dc0e1-5745-77b3-a566-7c160c374bdd
--------
user
changes against 'main'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff caf8b3c0c6ae1185ce54f346c16d64f21a5ac827' in C:\Alok\Business Projects\Goldsmith
 succeeded in 428ms:
diff --git a/ops/semgrep/money-safety.yml b/ops/semgrep/money-safety.yml
new file mode 100644
index 0000000..44d0a5c
--- /dev/null
+++ b/ops/semgrep/money-safety.yml
@@ -0,0 +1,17 @@
+rules:
+  - id: goldsmith-no-float-on-weight-or-price
+    patterns:
+      - pattern: parseFloat(...)
+      - pattern: Math.round(...)
+      - pattern: Number($X * ...)
+    message: >
+      Use packages/money Weight/MoneyInPaise or BigInt arithmetic.
+      No float arithmetic on weight or price fields.
+    languages: [typescript]
+    severity: ERROR
+    paths:
+      include:
+        - "packages/money/**"
+        - "packages/compliance/**"
+        - "apps/api/src/modules/pricing/**"
+        - "apps/api/src/modules/inventory/**"
diff --git a/ops/semgrep/tests/money-safety/bad.ts b/ops/semgrep/tests/money-safety/bad.ts
new file mode 100644
index 0000000..c41179f
--- /dev/null
+++ b/ops/semgrep/tests/money-safety/bad.ts
@@ -0,0 +1,10 @@
+// semgrep: goldsmith-no-float-on-weight-or-price should flag all lines below
+
+// parseFloat usage on weight/price
+const weight = parseFloat('10.5');
+
+// Math.round on a monetary value
+const rounded = Math.round(1234567);
+
+// Number multiplication (arithmetic, not display)
+const goldValue = Number('10.5') * 684200;
diff --git a/ops/semgrep/tests/money-safety/ok.ts b/ops/semgrep/tests/money-safety/ok.ts
new file mode 100644
index 0000000..835f09a
--- /dev/null
+++ b/ops/semgrep/tests/money-safety/ok.ts
@@ -0,0 +1,16 @@
+import Decimal from 'decimal.js';
+
+// Correct: use Decimal.js for weight/price arithmetic
+const weight = new Decimal('10.5000');
+const rate = 684_200n;
+
+// Correct: BigInt arithmetic for paise calculations
+const goldValuePaise = BigInt(
+  weight.mul(new Decimal(rate.toString()))
+    .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
+    .toString()
+);
+
+// Correct: Number() only for display string generation, not stored or used in arithmetic
+const displayStr = (Number(goldValuePaise) / 100).toLocaleString('hi-IN', { minimumFractionDigits: 2 });
+void displayStr;
diff --git a/packages/compliance/package.json b/packages/compliance/package.json
index 66a7644..cfa3220 100644
--- a/packages/compliance/package.json
+++ b/packages/compliance/package.json
@@ -15,7 +15,8 @@
     "build": "tsc -p tsconfig.build.json",
     "typecheck": "tsc --noEmit",
     "lint": "eslint src test",
-    "test": "vitest run"
+    "test": "vitest run",
+    "test:unit": "vitest run"
   },
   "dependencies": {},
   "devDependencies": {
diff --git a/packages/compliance/src/gst/rates.ts b/packages/compliance/src/gst/rates.ts
new file mode 100644
index 0000000..196d5d3
--- /dev/null
+++ b/packages/compliance/src/gst/rates.ts
@@ -0,0 +1,4 @@
+// Platform-controlled GST constants. Never accept from user input. Never configurable by shopkeeper.
+// Changing these values requires an ADR amendment (PRD NFR-C2).
+export const GST_METAL_RATE_BP  = 300 as const;  // 3% expressed in basis points
+export const GST_MAKING_RATE_BP = 500 as const;  // 5% expressed in basis points
diff --git a/packages/compliance/src/gst/split.ts b/packages/compliance/src/gst/split.ts
new file mode 100644
index 0000000..c228ecf
--- /dev/null
+++ b/packages/compliance/src/gst/split.ts
@@ -0,0 +1,25 @@
+import { GST_METAL_RATE_BP, GST_MAKING_RATE_BP } from './rates';
+
+export interface GstSplit {
+  metalGstPaise:  bigint;
+  makingGstPaise: bigint;
+  totalGstPaise:  bigint;
+}
+
+/**
+ * Pure function — no side effects, no DB, no network.
+ * Floors at each GST component (integer division = floor for positive bigints).
+ * Customer is never overcharged due to rounding direction (PRD NFR-C2).
+ */
+export function applyGstSplit(params: {
+  goldValuePaise:    bigint;
+  makingChargePaise: bigint;
+}): GstSplit {
+  const metalGstPaise  = (params.goldValuePaise    * BigInt(GST_METAL_RATE_BP))  / 10000n;
+  const makingGstPaise = (params.makingChargePaise * BigInt(GST_MAKING_RATE_BP)) / 10000n;
+  return {
+    metalGstPaise,
+    makingGstPaise,
+    totalGstPaise: metalGstPaise + makingGstPaise,
+  };
+}
diff --git a/packages/compliance/src/index.ts b/packages/compliance/src/index.ts
index f1468a0..151e656 100644
--- a/packages/compliance/src/index.ts
+++ b/packages/compliance/src/index.ts
@@ -1 +1,4 @@
 export { validateHuidFormat } from './huid/validate';
+export { GST_METAL_RATE_BP, GST_MAKING_RATE_BP } from './gst/rates';
+export type { GstSplit } from './gst/split';
+export { applyGstSplit } from './gst/split';
diff --git a/packages/compliance/test/gst/split.test.ts b/packages/compliance/test/gst/split.test.ts
new file mode 100644
index 0000000..f8a26cc
--- /dev/null
+++ b/packages/compliance/test/gst/split.test.ts
@@ -0,0 +1,35 @@
+import { describe, it, expect } from 'vitest';
+import { applyGstSplit } from '../../src/gst/split';
+
+describe('applyGstSplit', () => {
+  it('computes 3% metal GST on gold value of ₹68,420 → 205,260 paise (floor)', () => {
+    // 6,842,000 paise × 300 / 10000 = 205,260 paise exactly
+    const result = applyGstSplit({ goldValuePaise: 6_842_000n, makingChargePaise: 0n });
+    expect(result.metalGstPaise).toBe(205_260n);
+  });
+
+  it('computes 5% making GST on making charge of ₹8,210.40 → 41,052 paise (floor)', () => {
+    // 821,040 paise × 500 / 10000 = 41,052 paise exactly (not ₹410.52 rounded up)
+    const result = applyGstSplit({ goldValuePaise: 0n, makingChargePaise: 821_040n });
+    expect(result.makingGstPaise).toBe(41_052n);
+  });
+
+  it('returns zero GST for zero inputs', () => {
+    const result = applyGstSplit({ goldValuePaise: 0n, makingChargePaise: 0n });
+    expect(result.metalGstPaise).toBe(0n);
+    expect(result.makingGstPaise).toBe(0n);
+    expect(result.totalGstPaise).toBe(0n);
+  });
+
+  it('floors metal GST: 99 paise × 300 / 10000 = 2 not 3', () => {
+    // 99 × 300 = 29700, 29700 / 10000 = 2 (integer division floors)
+    const result = applyGstSplit({ goldValuePaise: 99n, makingChargePaise: 0n });
+    expect(result.metalGstPaise).toBe(2n);
+  });
+
+  it('totalGstPaise is sum of metal and making GST', () => {
+    const result = applyGstSplit({ goldValuePaise: 6_842_000n, makingChargePaise: 821_040n });
+    expect(result.totalGstPaise).toBe(result.metalGstPaise + result.makingGstPaise);
+    expect(result.totalGstPaise).toBe(246_312n);
+  });
+});
diff --git a/packages/money/package.json b/packages/money/package.json
index 8f88d14..0583b36 100644
--- a/packages/money/package.json
+++ b/packages/money/package.json
@@ -15,10 +15,12 @@
     "build": "tsc -p tsconfig.build.json",
     "typecheck": "tsc --noEmit",
     "lint": "eslint src test",
-    "test": "vitest run"
+    "test": "vitest run",
+    "test:unit": "vitest run"
   },
   "dependencies": {
-    "decimal.js": "^10.4.3"
+    "decimal.js": "^10.4.3",
+    "@goldsmith/compliance": "workspace:*"
   },
   "devDependencies": {
     "vitest": "^1.4.0",
diff --git a/packages/money/src/index.ts b/packages/money/src/index.ts
index a5535c0..61c0867 100644
--- a/packages/money/src/index.ts
+++ b/packages/money/src/index.ts
@@ -1,2 +1,4 @@
 export { Weight } from './weight';
 export { MoneyInPaise } from './money';
+export type { PriceInput, PriceBreakdown } from './pricing';
+export { computeProductPrice } from './pricing';
diff --git a/packages/money/src/pricing.ts b/packages/money/src/pricing.ts
new file mode 100644
index 0000000..20179b5
--- /dev/null
+++ b/packages/money/src/pricing.ts
@@ -0,0 +1,109 @@
+import Decimal from 'decimal.js';
+import { applyGstSplit } from '@goldsmith/compliance';
+
+export interface PriceInput {
+  netWeightG:        string;  // DECIMAL(12,4) string — e.g. "10.0000"
+  ratePerGramPaise:  bigint;  // from pricing service
+  makingChargePct:   string;  // DECIMAL(5,2) string — e.g. "12.00"
+  stoneChargesPaise: bigint;  // may be 0n
+  hallmarkFeePaise:  bigint;  // may be 0n (non-hallmarked pieces)
+}
+
+export interface PriceBreakdown {
+  goldValuePaise:    bigint;
+  makingChargePaise: bigint;
+  stoneChargesPaise: bigint;
+  gstMetalPaise:     bigint;
+  gstMakingPaise:    bigint;
+  hallmarkFeePaise:  bigint;
+  totalPaise:        bigint;
+  // Display helpers — pre-formatted, never use for arithmetic
+  totalRupees:       string;  // e.g. "84,138.52"
+  totalFormatted:    string;  // e.g. "₹84,138.52"
+}
+
+function validateInputs(input: PriceInput): void {
+  let weightDecimal: Decimal;
+  try {
+    weightDecimal = new Decimal(input.netWeightG);
+  } catch {
+    throw new RangeError('netWeightG must be a valid positive decimal string');
+  }
+  if (weightDecimal.isNaN() || !weightDecimal.isFinite() || weightDecimal.lte(0)) {
+    throw new RangeError('netWeightG must be a positive finite number');
+  }
+
+  if (input.ratePerGramPaise <= 0n) {
+    throw new RangeError('ratePerGramPaise must be > 0');
+  }
+
+  let makingPct: Decimal;
+  try {
+    makingPct = new Decimal(input.makingChargePct);
+  } catch {
+    throw new RangeError('makingChargePct must be a valid decimal string');
+  }
+  if (makingPct.isNaN() || !makingPct.isFinite() || makingPct.lt(0) || makingPct.gt(100)) {
+    throw new RangeError('makingChargePct must be between 0.00 and 100.00');
+  }
+
+  if (input.stoneChargesPaise < 0n) {
+    throw new RangeError('stoneChargesPaise must be >= 0');
+  }
+  if (input.hallmarkFeePaise < 0n) {
+    throw new RangeError('hallmarkFeePaise must be >= 0');
+  }
+}
+
+export function computeProductPrice(input: PriceInput): PriceBreakdown {
+  validateInputs(input);
+
+  // Step 1: gold value — floor via ROUND_FLOOR on the Decimal result, then BigInt
+  const goldValuePaise = BigInt(
+    new Decimal(input.ratePerGramPaise.toString())
+      .mul(new Decimal(input.netWeightG))
+      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
+      .toString(),
+  );
+
+  // Step 2: making charge — floor
+  const makingChargePaise = BigInt(
+    new Decimal(goldValuePaise.toString())
+      .mul(new Decimal(input.makingChargePct))
+      .div(100)
+      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
+      .toString(),
+  );
+
+  // Step 3 + 4: GST split — pure BigInt arithmetic (integer division = floor)
+  const { metalGstPaise, makingGstPaise } = applyGstSplit({
+    goldValuePaise,
+    makingChargePaise,
+  });
+
+  // Step 5: total
+  const totalPaise =
+    goldValuePaise +
+    makingChargePaise +
+    input.stoneChargesPaise +
+    metalGstPaise +
+    makingGstPaise +
+    input.hallmarkFeePaise;
+
+  // Display-only conversion — safe up to ~900 trillion paise (₹9 trillion)
+  const totalRupees = (Number(totalPaise) / 100).toLocaleString('hi-IN', {
+    minimumFractionDigits: 2,
+  });
+
+  return {
+    goldValuePaise,
+    makingChargePaise,
+    stoneChargesPaise: input.stoneChargesPaise,
+    gstMetalPaise:     metalGstPaise,
+    gstMakingPaise:    makingGstPaise,
+    hallmarkFeePaise:  input.hallmarkFeePaise,
+    totalPaise,
+    totalRupees,
+    totalFormatted: `₹${totalRupees}`,
+  };
+}
diff --git a/packages/money/test/pricing.test.ts b/packages/money/test/pricing.test.ts
new file mode 100644
index 0000000..9d39105
--- /dev/null
+++ b/packages/money/test/pricing.test.ts
@@ -0,0 +1,145 @@
+import { describe, it, expect } from 'vitest';
+import { computeProductPrice } from '../src/pricing';
+
+const GOLDEN_INPUT = {
+  netWeightG:        '10.0000',
+  ratePerGramPaise:  684_200n,  // ₹6,842/g
+  makingChargePct:   '12.00',
+  stoneChargesPaise: 500_000n,  // ₹5,000
+  hallmarkFeePaise:  4_500n,    // ₹45
+};
+
+describe('computeProductPrice', () => {
+  describe('golden example from AC', () => {
+    it('computes gold value correctly', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.goldValuePaise).toBe(6_842_000n);
+    });
+
+    it('computes making charge correctly', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.makingChargePaise).toBe(821_040n);
+    });
+
+    it('computes metal GST correctly', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.gstMetalPaise).toBe(205_260n);
+    });
+
+    it('computes making GST correctly', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.gstMakingPaise).toBe(41_052n);
+    });
+
+    it('passes through stone and hallmark charges', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.stoneChargesPaise).toBe(500_000n);
+      expect(r.hallmarkFeePaise).toBe(4_500n);
+    });
+
+    it('computes total = 8,413,852 paise = ₹84,138.52', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      // 6842000 + 821040 + 500000 + 205260 + 41052 + 4500 = 8413852
+      expect(r.totalPaise).toBe(8_413_852n);
+    });
+
+    it('formats totalFormatted with rupee symbol', () => {
+      const r = computeProductPrice(GOLDEN_INPUT);
+      expect(r.totalFormatted.startsWith('₹')).toBe(true);
+    });
+  });
+
+  describe('validation errors', () => {
+    it('throws on zero weight', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: '0.0000' })).toThrow(RangeError);
+    });
+
+    it('throws on negative weight', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: '-1.0000' })).toThrow(RangeError);
+    });
+
+    it('throws on non-numeric weight string', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: 'abc' })).toThrow(RangeError);
+    });
+
+    it('throws on zero rate', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, ratePerGramPaise: 0n })).toThrow(RangeError);
+    });
+
+    it('throws on negative rate', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, ratePerGramPaise: -1n })).toThrow(RangeError);
+    });
+
+    it('throws on making charge > 100', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '100.01' })).toThrow(RangeError);
+    });
+
+    it('throws on negative stone charges', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, stoneChargesPaise: -1n })).toThrow(RangeError);
+    });
+
+    it('throws on negative hallmark fee', () => {
+      expect(() => computeProductPrice({ ...GOLDEN_INPUT, hallmarkFeePaise: -1n })).toThrow(RangeError);
+    });
+  });
+
+  describe('edge cases', () => {
+    it('making charge 0%: making and GST-making both 0', () => {
+      const r = computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '0.00' });
+      expect(r.makingChargePaise).toBe(0n);
+      expect(r.gstMakingPaise).toBe(0n);
+    });
+
+    it('making charge 100%: valid, making = gold value', () => {
+      const r = computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '100.00' });
+      expect(r.makingChargePaise).toBe(r.goldValuePaise);
+    });
+
+    it('stone charges 0n: stoneChargesPaise = 0 in breakdown', () => {
+      const r = computeProductPrice({ ...GOLDEN_INPUT, stoneChargesPaise: 0n });
+      expect(r.stoneChargesPaise).toBe(0n);
+    });
+
+    it('hallmark fee 0n: hallmarkFeePaise = 0 in breakdown', () => {
+      const r = computeProductPrice({ ...GOLDEN_INPUT, hallmarkFeePaise: 0n });
+      expect(r.hallmarkFeePaise).toBe(0n);
+    });
+
+    it('very small weight (0.0001g) at high rate: floors correctly', () => {
+      // 0.0001g × 1,000,000 paise/g = 100 paise exactly
+      const r = computeProductPrice({
+        netWeightG:        '0.0001',
+        ratePerGramPaise:  1_000_000n,
+        makingChargePct:   '0.00',
+        stoneChargesPaise: 0n,
+        hallmarkFeePaise:  0n,
+      });
+      expect(r.goldValuePaise).toBe(100n);
+    });
+
+    it('very small weight at rate that produces sub-paise: floors to lower paise', () => {
+      // 0.0001g × 684200 paise/g = 68.42 paise → floor → 68 paise
+      const r = computeProductPrice({
+        netWeightG:        '0.0001',
+        ratePerGramPaise:  684_200n,
+        makingChargePct:   '0.00',
+        stoneChargesPaise: 0n,
+        hallmarkFeePaise:  0n,
+      });
+      expect(r.goldValuePaise).toBe(68n);  // floor(68.42)
+    });
+
+    it('very large weight (999.9999g) at high rate: no overflow (BigInt)', () => {
+      const r = computeProductPrice({
+        netWeightG:        '999.9999',
+        ratePerGramPaise:  1_000_000n,  // ₹10,000/g
+        makingChargePct:   '0.00',
+        stoneChargesPaise: 0n,
+        hallmarkFeePaise:  0n,
+      });
+      // 999.9999g × 1,000,000 = 999,999,900 paise ≈ ₹9,999,999 — well within BigInt range
+      expect(r.goldValuePaise).toBe(999_999_900n);
+      expect(typeof r.totalPaise).toBe('bigint');
+    });
+  });
+});
diff --git a/packages/money/vitest.config.ts b/packages/money/vitest.config.ts
new file mode 100644
index 0000000..87a425a
--- /dev/null
+++ b/packages/money/vitest.config.ts
@@ -0,0 +1,16 @@
+import { defineConfig } from 'vitest/config';
+import { fileURLToPath } from 'node:url';
+
+export default defineConfig({
+  resolve: {
+    alias: {
+      // Resolve from source so `test:unit` runs without a prior build of compliance
+      '@goldsmith/compliance': fileURLToPath(
+        new URL('../compliance/src/index.ts', import.meta.url),
+      ),
+    },
+  },
+  test: {
+    environment: 'node',
+  },
+});
diff --git a/packages/testing/weight-precision/package.json b/packages/testing/weight-precision/package.json
new file mode 100644
index 0000000..215903a
--- /dev/null
+++ b/packages/testing/weight-precision/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@goldsmith/testing-weight-precision",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/harness.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:unit": "vitest run"
+  },
+  "dependencies": {
+    "@goldsmith/money": "workspace:*",
+    "decimal.js": "^10.4.3"
+  },
+  "devDependencies": {
+    "vitest": "^1.4.0",
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/packages/testing/weight-precision/src/harness.ts b/packages/testing/weight-precision/src/harness.ts
new file mode 100644
index 0000000..88fdca9
--- /dev/null
+++ b/packages/testing/weight-precision/src/harness.ts
@@ -0,0 +1,86 @@
+import Decimal from 'decimal.js';
+import { computeProductPrice } from '@goldsmith/money';
+import type { PriceInput } from '@goldsmith/money';
+
+const GST_METAL_BP  = 300n;
+const GST_MAKING_BP = 500n;
+
+export interface HarnessResult {
+  total:    number;
+  passed:   number;
+  failed:   number;
+  failures: Array<{ input: PriceInput; expected: bigint; actual: bigint }>;
+}
+
+/**
+ * Independent Decimal.js golden reference.
+ * Replicates the formula using ROUND_FLOOR at every step — same as computeProductPrice.
+ * Used to cross-validate BigInt arithmetic in pricing.ts across 10,000 random inputs.
+ */
+function goldenTotal(input: PriceInput): bigint {
+  const goldValuePaise = BigInt(
+    new Decimal(input.ratePerGramPaise.toString())
+      .mul(new Decimal(input.netWeightG))
+      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
+      .toString(),
+  );
+
+  const makingChargePaise = BigInt(
+    new Decimal(goldValuePaise.toString())
+      .mul(new Decimal(input.makingChargePct))
+      .div(100)
+      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
+      .toString(),
+  );
+
+  const metalGstPaise  = (goldValuePaise    * GST_METAL_BP)  / 10000n;
+  const makingGstPaise = (makingChargePaise * GST_MAKING_BP) / 10000n;
+
+  return goldValuePaise + makingChargePaise + input.stoneChargesPaise + metalGstPaise + makingGstPaise + input.hallmarkFeePaise;
+}
+
+function randomDecimal(lo: number, hi: number, decimals: number): string {
+  const range = hi - lo;
+  const raw   = lo + Math.random() * range;
+  return raw.toFixed(decimals);
+}
+
+function randomBigIntRange(lo: bigint, hi: bigint): bigint {
+  const range = Number(hi - lo);
+  return lo + BigInt(Math.floor(Math.random() * range));
+}
+
+export async function runWeightPrecisionHarness(): Promise<HarnessResult> {
+  const TOTAL = 10_000;
+  const failures: HarnessResult['failures'] = [];
+
+  for (let i = 0; i < TOTAL; i++) {
+    const netWeightG       = randomDecimal(0.0001, 999.9999, 4);
+    const ratePerGramPaise = randomBigIntRange(100_000n, 1_000_000n);
+    const makingChargePct  = randomDecimal(0, 25, 2);
+    const stoneChargesPaise = randomBigIntRange(0n, 10_000_000n);
+    const hallmarkFeePaise  = Math.random() < 0.5 ? 0n : 4_500n;
+
+    const input: PriceInput = {
+      netWeightG,
+      ratePerGramPaise,
+      makingChargePct,
+      stoneChargesPaise,
+      hallmarkFeePaise,
+    };
+
+    const expected = goldenTotal(input);
+    const actual   = computeProductPrice(input).totalPaise;
+
+    if (actual !== expected) {
+      failures.push({ input, expected, actual });
+    }
+  }
+
+  return {
+    total:  TOTAL,
+    passed: TOTAL - failures.length,
+    failed: failures.length,
+    failures,
+  };
+}
diff --git a/packages/testing/weight-precision/test/harness.test.ts b/packages/testing/weight-precision/test/harness.test.ts
new file mode 100644
index 0000000..dd28cac
--- /dev/null
+++ b/packages/testing/weight-precision/test/harness.test.ts
@@ -0,0 +1,20 @@
+import { describe, it, expect } from 'vitest';
+import { runWeightPrecisionHarness } from '../src/harness';
+
+describe('weight-precision harness', () => {
+  it('runs 10,000 random price computations with zero paise-level failures', async () => {
+    const result = await runWeightPrecisionHarness();
+
+    expect(result.total).toBe(10_000);
+
+    if (result.failed > 0) {
+      const sample = result.failures.slice(0, 3);
+      const detail = sample
+        .map(f => `input=${JSON.stringify(f.input, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))} expected=${f.expected} actual=${f.actual}`)
+        .join('\n');
+      throw new Error(`${result.failed} paise-level mismatches (showing up to 3):\n${detail}`);
+    }
+
+    expect(result.failed).toBe(0);
+  }, 30_000);  // 30s timeout for 10k iterations
+});
diff --git a/packages/testing/weight-precision/tsconfig.json b/packages/testing/weight-precision/tsconfig.json
new file mode 100644
index 0000000..3f5a69f
--- /dev/null
+++ b/packages/testing/weight-precision/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "extends": "../../../tsconfig.base.json",
+  "include": ["src/**/*", "test/**/*"]
+}
diff --git a/packages/testing/weight-precision/vitest.config.ts b/packages/testing/weight-precision/vitest.config.ts
new file mode 100644
index 0000000..093c253
--- /dev/null
+++ b/packages/testing/weight-precision/vitest.config.ts
@@ -0,0 +1,19 @@
+import { defineConfig } from 'vitest/config';
+import { fileURLToPath } from 'node:url';
+
+export default defineConfig({
+  resolve: {
+    alias: {
+      // Resolve from source so the harness runs without prior builds
+      '@goldsmith/money': fileURLToPath(
+        new URL('../../money/src/index.ts', import.meta.url),
+      ),
+      '@goldsmith/compliance': fileURLToPath(
+        new URL('../../compliance/src/index.ts', import.meta.url),
+      ),
+    },
+  },
+  test: {
+    environment: 'node',
+  },
+});
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 9efa993..bb1ce80 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -478,6 +478,9 @@ importers:
 
   packages/money:
     dependencies:
+      '@goldsmith/compliance':
+        specifier: workspace:*
+        version: link:../compliance
       decimal.js:
         specifier: ^10.4.3
         version: 10.6.0
@@ -648,6 +651,22 @@ importers:
         specifier: ^1.4.0
         version: 1.6.1(@types/node@22.19.17)(jsdom@24.1.3)(terser@5.46.1)
 
+  packages/testing/weight-precision:
+    dependencies:
+      '@goldsmith/money':
+        specifier: workspace:*
+        version: link:../../money
+      decimal.js:
+        specifier: ^10.4.3
+        version: 10.6.0
+    devDependencies:
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@22.19.17)(jsdom@24.1.3)(terser@5.46.1)
+
   packages/ui-mobile:
     dependencies:
       '@goldsmith/ui-tokens':
@@ -2118,7 +2137,7 @@ packages:
 
   '@expo/bunyan@4.0.1':
     resolution: {integrity: sha512-+Lla7nYSiHZirgK+U/uYzsLv/X+HaJienbD5AKX1UQZHYfWaP+9uuQluRB4GrEVWF0GZ7vEVp/jzaOT9k/SQlg==}
-    engines: {'0': node >=0.10.0}
+    engines: {node: '>=0.10.0'}
 
   '@expo/cli@0.18.31':
     resolution: {integrity: sha512-v9llw9fT3Uv+TCM6Xllo54t672CuYtinEQZ2LPJ2EJsCwuTc4Cd2gXQaouuIVD21VoeGQnr5JtJuWbF97sBKzQ==}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/compliance/package.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/money/package.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content pnpm-workspace.yaml' in C:\Alok\Business Projects\Goldsmith
 succeeded in 438ms:
{
  "name": "@goldsmith/compliance",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}

 succeeded in 471ms:
{
  "name": "@goldsmith/money",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "decimal.js": "^10.4.3",
    "@goldsmith/compliance": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}

 succeeded in 414ms:
packages:
  - "apps/*"
  - "packages/*"
  - "packages/testing/*"
  - "packages/integrations/*"
  - "ops/eslint-rules/*"

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/money/tsconfig.build.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem packages/money; Get-ChildItem packages/compliance' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/compliance/tsconfig.build.json' in C:\Alok\Business Projects\Goldsmith
 succeeded in 335ms:
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "test/**/*"]
}

 succeeded in 349ms:
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "test/**/*"]
}

 succeeded in 795ms:


    Directory: C:\Alok\Business Projects\Goldsmith\packages\money


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/24/2026   3:02 PM                .turbo                                                               
d-----         4/24/2026   2:51 PM                dist                                                                 
d-----         4/24/2026   2:50 PM                node_modules                                                         
d-----         4/24/2026   2:57 PM                src                                                                  
d-----         4/24/2026   2:57 PM                test                                                                 
-a----         4/24/2026   3:00 PM            666 package.json                                                         
-a----         4/23/2026  11:04 PM            190 tsconfig.build.json                                                  
-a----         4/23/2026  11:04 PM             88 tsconfig.json                                                        
-a----         4/24/2026   3:01 PM            405 vitest.config.ts                                                     


    Directory: C:\Alok\Business Projects\Goldsmith\packages\compliance


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/24/2026   3:02 PM                .turbo                                                               
d-----         4/24/2026   2:50 PM                dist                                                                 
d-----         4/24/2026   1:30 PM                node_modules                                                         
d-----         4/24/2026   2:57 PM                src                                                                  
d-----         4/24/2026   2:57 PM                test                                                                 
-a----         4/24/2026   3:00 PM            593 package.json                                                         
-a----         4/23/2026  11:04 PM            190 tsconfig.build.json                                                  
-a----         4/23/2026  11:04 PM             88 tsconfig.json                                                        



2026-04-24T19:05:14.861317Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive | ForEach-Object { \""'$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive | ForEach-Object { \""'$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content ops/semgrep/money-safety.yml' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive | ForEach-Object { \""'$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }'` rejected: blocked by policy
 succeeded in 538ms:
rules:
  - id: goldsmith-no-float-on-weight-or-price
    patterns:
      - pattern: parseFloat(...)
      - pattern: Math.round(...)
      - pattern: Number($X * ...)
    message: >
      Use packages/money Weight/MoneyInPaise or BigInt arithmetic.
      No float arithmetic on weight or price fields.
    languages: [typescript]
    severity: ERROR
    paths:
      include:
        - "packages/money/**"
        - "packages/compliance/**"
        - "apps/api/src/modules/pricing/**"
        - "apps/api/src/modules/inventory/**"

2026-04-24T19:05:19.638369Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/money,packages/compliance,apps/api/src/modules/pricing,apps/api/src/modules/inventory -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern 'Math\\.round\\(|parseFloat\\(|Number\\(' -CaseSensitive"` rejected: blocked by policy
2026-04-24T19:05:22.481566Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n -E \"Math\\.round\\(|parseFloat\\(|Number\\(\" -- packages/money packages/compliance apps/api/src/modules/pricing apps/api/src/modules/inventory"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n -E \"Math\\.round\\(|parseFloat\\(|Number\\(\" -- packages/money packages/compliance apps/api/src/modules/pricing apps/api/src/modules/inventory" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n -E \"Math\\.round\\(|parseFloat\\(|Number\\(\" -- packages/money packages/compliance apps/api/src/modules/pricing apps/api/src/modules/inventory"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content tsconfig.base.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/money/tsconfig.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem packages -Directory | Select-Object -ExpandProperty Name' in C:\Alok\Business Projects\Goldsmith
 succeeded in 1060ms:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}

 succeeded in 1282ms:
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "test/**/*"]
}

 succeeded in 2251ms:
audit
auth-client
cache
compliance
crypto-envelope
db
i18n
integrations
money
observability
queue
secrets
shared
tenant-config
tenant-context
testing
ui-mobile
ui-tokens

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages -Filter package.json | Select-String 'workspace:\\*'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 1435ms:

packages\audit\package.json:22:    "@goldsmith/db": "workspace:*",
packages\audit\package.json:23:    "@goldsmith/tenant-context": "workspace:*",
packages\cache\package.json:22:    "@goldsmith/tenant-context": "workspace:*"
packages\db\package.json:24:    "@goldsmith/observability": "workspace:*",
packages\db\package.json:25:    "@goldsmith/tenant-context": "workspace:*",
packages\integrations\rates\package.json:21:    "@goldsmith/cache": "workspace:*",
packages\money\package.json:23:    "@goldsmith/compliance": "workspace:*"
packages\queue\package.json:13:    "@goldsmith/tenant-context": "workspace:*",
packages\queue\package.json:14:    "@goldsmith/observability": "workspace:*"
packages\tenant-config\package.json:21:    "@goldsmith/shared": "workspace:*",
packages\tenant-config\package.json:22:    "@goldsmith/cache": "workspace:*",
packages\tenant-config\package.json:23:    "@goldsmith/tenant-context": "workspace:*"
packages\testing\tenant-isolation\package.json:17:    "@goldsmith/db": "workspace:*",
packages\testing\tenant-isolation\package.json:18:    "@goldsmith/tenant-context": "workspace:*",
packages\testing\weight-precision\package.json:13:    "@goldsmith/money": "workspace:*",
packages\ui-mobile\package.json:17:    "@goldsmith/ui-tokens": "workspace:*"



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/audit/package.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/audit/tsconfig.json' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/package.json' in C:\Alok\Business Projects\Goldsmith
 succeeded in 401ms:
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }

 succeeded in 416ms:
{
  "name": "@goldsmith/audit",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:integration": "vitest run --dir test"
  },
  "dependencies": {
    "@goldsmith/db": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "testcontainers": "^10.8.0",
    "@testcontainers/postgresql": "^10.8.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.4.0"
  }
}

 succeeded in 453ms:
{
  "name": "@goldsmith/db",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run --dir src",
    "test:integration": "vitest run --dir test",
    "db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
  },
  "dependencies": {
    "@goldsmith/observability": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "drizzle-orm": "^0.30.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@testcontainers/postgresql": "^10.8.0",
    "testcontainers": "^10.8.0",
    "drizzle-kit": "^0.21.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0"
  }
}

2026-04-24T19:06:00.864296Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content ops/semgrep/money-safety.yml | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
2026-04-24T19:06:00.864845Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/money/src/pricing.ts | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/money/src/pricing.ts | ForEach-Object {"$i	$_"; $i++}' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content ops/semgrep/money-safety.yml | ForEach-Object {"$i	$_"; $i++}' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/compliance/src/gst/split.ts | ForEach-Object {"$i	$_"; $i++}' in C:\Alok\Business Projects\Goldsmith
2026-04-24T19:06:00.865425Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/compliance/src/gst/split.ts | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content ops/semgrep/money-safety.yml | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/money/src/pricing.ts | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/compliance/src/gst/split.ts | ForEach-Object {"$i	$_"; $i++}'` rejected: blocked by policy
2026-04-24T19:06:05.548439Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\money\\src\\pricing.ts"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\money\\src\\pricing.ts" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" ops\\semgrep\\money-safety.yml" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\money\\src\\pricing.ts"` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" ops\\semgrep\\money-safety.yml"` rejected: blocked by policy
2026-04-24T19:06:05.551625Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" ops\\semgrep\\money-safety.yml"` rejected: blocked by policy
2026-04-24T19:06:05.569158Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\compliance\\src\\gst\\split.ts"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\compliance\\src\\gst\\split.ts" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "cmd /c findstr /n \".*\" packages\\compliance\\src\\gst\\split.ts"` rejected: blocked by policy
codex
The new pricing and GST code is mostly sound, but the Semgrep guardrail added in this patch is currently ineffective and the formatting path can misstate very large totals due to a lossy bigint-to-number conversion. Those issues make the patch incorrect as submitted.

Full review comments:

- [P2] Use `pattern-either` so the money-safety rule can match — C:\Alok\Business Projects\Goldsmith\ops\semgrep\money-safety.yml:3-6
  `patterns` is an AND in Semgrep, so this rule only fires on code that simultaneously contains `parseFloat(...)`, `Math.round(...)`, and `Number($X * ...)` in the same match. None of the new `bad.ts` examples satisfy that, which means the guardrail is effectively disabled and float-based price logic in the targeted directories will pass unnoticed.

- [P2] Match arithmetic after `Number(...)`, not only inside it — C:\Alok\Business Projects\Goldsmith\ops\semgrep\money-safety.yml:6-6
  The dangerous case in the new test is `Number('10.5') * 684200`, but `Number($X * ...)` only matches multiplication that happens inside the `Number(...)` call. Even after fixing the rule composition, this pattern will still miss the exact float-arithmetic form the test is trying to ban, so the safety check will keep producing false negatives.

- [P3] Guard or avoid lossy `Number` conversion for formatted totals — C:\Alok\Business Projects\Goldsmith\packages\money\src\pricing.ts:94-96
  `totalPaise` is computed as a `bigint`, but the display path converts it with `Number(totalPaise)` before formatting. That silently loses paise precision once totals exceed `Number.MAX_SAFE_INTEGER`, and there is no validation enforcing the “safe up to ~900 trillion paise” assumption in the comment, so large valid inputs can return incorrect `totalRupees`/`totalFormatted` strings while `totalPaise` remains correct.
The new pricing and GST code is mostly sound, but the Semgrep guardrail added in this patch is currently ineffective and the formatting path can misstate very large totals due to a lossy bigint-to-number conversion. Those issues make the patch incorrect as submitted.

Full review comments:

- [P2] Use `pattern-either` so the money-safety rule can match — C:\Alok\Business Projects\Goldsmith\ops\semgrep\money-safety.yml:3-6
  `patterns` is an AND in Semgrep, so this rule only fires on code that simultaneously contains `parseFloat(...)`, `Math.round(...)`, and `Number($X * ...)` in the same match. None of the new `bad.ts` examples satisfy that, which means the guardrail is effectively disabled and float-based price logic in the targeted directories will pass unnoticed.

- [P2] Match arithmetic after `Number(...)`, not only inside it — C:\Alok\Business Projects\Goldsmith\ops\semgrep\money-safety.yml:6-6
  The dangerous case in the new test is `Number('10.5') * 684200`, but `Number($X * ...)` only matches multiplication that happens inside the `Number(...)` call. Even after fixing the rule composition, this pattern will still miss the exact float-arithmetic form the test is trying to ban, so the safety check will keep producing false negatives.

- [P3] Guard or avoid lossy `Number` conversion for formatted totals — C:\Alok\Business Projects\Goldsmith\packages\money\src\pricing.ts:94-96
  `totalPaise` is computed as a `bigint`, but the display path converts it with `Number(totalPaise)` before formatting. That silently loses paise precision once totals exceed `Number.MAX_SAFE_INTEGER`, and there is no validation enforcing the “safe up to ~900 trillion paise” assumption in the comment, so large valid inputs can return incorrect `totalRupees`/`totalFormatted` strings while `totalPaise` remains correct.
