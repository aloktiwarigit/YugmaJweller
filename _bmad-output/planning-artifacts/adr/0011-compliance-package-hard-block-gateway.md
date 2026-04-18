# 0011 — Compliance: Dedicated Package with Pure-Function Hard-Block Gateway

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Murat (Test Architect), Mary (BA on regulatory depth)
**Consulted:** Alok (Agency non-negotiables)

## Context

PRD §Domain Requirements + §Functional Requirements FR41–55 + §NFR-C1–9 specify **five stacked compliance surfaces**:
- BIS Hallmarking + HUID (mandatory per product; present on every hallmarked invoice)
- GST 3% metal + 5% making (HSN 7113/7114); URD/RCM self-invoice on old-gold purchase
- Section 269ST cash cap at Rs 1,99,999 (receiver = jeweller pays 100% penalty)
- PAN Rule 114B at Rs 2L threshold (hard-block without PAN/Form 60)
- PMLA cumulative monthly cash ≥ Rs 10L → CTR auto-generation; STR template for suspicious

All are **hard-blocks, not warnings** — non-compliance carries fines + imprisonment + loss of BIS registration. Regulatory rules change (GST rates have historically shifted; BIS district list expands); the compliance engine must be versionable.

## Decision

Create **`packages/compliance`** as the single authoritative home for all regulatory rules. All financial state transitions pass through pure-function or transactional-helper gates exposed here. **No feature module re-implements any rule.**

### Surfaces (module layout)

```
packages/compliance/src/
  gst/
    split.ts              # applyGstSplit({ metalPaise, makingPaise }) -> GstBreakdown (3% + 5%)
    rates.ts              # GST_METAL_RATE_BP = 300, GST_MAKING_RATE_BP = 500
  cash-cap/
    section-269st.ts      # enforce269ST(...) -> throws ComplianceHardBlockError
                          # override269ST(...) -> allowed path with role + audit
  pan/
    rule-114b.ts          # enforcePanRequired({ total, pan, form60 }) -> throws if missing
    validate-format.ts    # PAN format regex + checksum
    encrypt.ts             # Uses packages/security/envelope for encryptPan
  pmla/
    cumulative.ts         # trackPmlaCumulative(...) -> updates pmla_aggregates + emits warnings
    ctr-template.ts       # generateCtrTemplate(...) -> pre-filled PDF/JSON
    str-template.ts       # generateStrTemplate(...)
  huid/
    validate.ts           # validateHuidPresence(lines) + validateHuidFormat
    bis-district.ts       # isBisMandatoryDistrict(district) lookup
  urd-rcm/
    self-invoice.ts       # buildUrdSelfInvoice(...) — generates RCM-compliant self-invoice
    margin-scheme.ts      # (feature-flagged; default RCM per PRD conservative choice)
  tcs/
    bullion.ts            # computeTcsOnBullion({ cashAmount }) -> 1% on > Rs 2L cash
  rules-versioning.ts     # Loads active compliance_rules_versions row; dispatches to versioned impls
  errors.ts               # ComplianceHardBlockError hierarchy with error codes
  index.ts                # Public API
```

### Hard-block function contract

Every gate function is one of:
- **Pure** (no side effects): `applyGstSplit`, `validateHuidPresence`, `isBisMandatoryDistrict`, `validatePanFormat` — easy to test, deterministic.
- **Read-only** (reads DB, no writes): `enforcePanRequired` (checks if PAN captured), `enforce269ST` (reads today's cash aggregate).
- **Transactional** (mutates aggregates): `trackPmlaCumulative` — called inside the invoice transaction.

On violation: throw `ComplianceHardBlockError` subclass with:
- `errorCode` (namespaced: `compliance.cash_cap_exceeded`, `compliance.pan_required`, `compliance.huid_missing`, `compliance.pmla_threshold_blocked`, etc.).
- `messageKey` (i18n key: `compliance.pan_required.title` + `compliance.pan_required.body`).
- Optional `allowedOverridePath` (e.g., `override269ST` for cash cap; `null` for PAN which has no override).

### Rule versioning

`compliance_rules_versions` table:
```
id | effective_from | expires_at | rule_set_json | created_by | approved_by
```

`rule_set_json` contains:
- GST rates (metal + making) in basis points.
- Section 269ST cap in paise.
- PAN threshold in paise.
- PMLA warning + block thresholds.
- Mandatory BIS districts list.

On every gate call, `rules-versioning.ts` loads the active version (cached 60s Redis); dispatches to versioned implementations.

- GST rate change (e.g., government updates to 4%) = new version row + migration plan + gradual rollout per feature flag.
- PMLA threshold change = new version; old invoices remain tied to their rule version for audit.

### Enforcement

- **Semgrep rule `goldsmith/compliance-gates-required`** scans invoice-creation code paths; rejects PRs that mutate `invoices` table without preceding calls to `applyGstSplit` + `validateHuidPresence` + `enforcePanRequired` + `enforce269ST`.
- **Code-review gate** (/feature-dev:code-reviewer + /bmad-code-review) checklist item: "compliance gates called in correct order?"
- **CI test suite `packages/testing/compliance-gates`** asserts every NFR-C1..9 has at least one test case proving hard-block triggers.
- **Audit**: every gate call logs to `audit_events` via `packages/audit`.

### UX integration

- Errors surface as `ComplianceInlineAlert` (per UX spec) — warm Hindi tone ("hum aapki safety ke liye" framing, per UX Principle #4: "Compliance is care, not bureaucracy").
- Override paths (supervisor override for 269ST) use a separate UI (role-gated, justification-required) — the gate function `override269ST` is an explicit alternate API, not a bypass.
- Version info surfaced to shopkeeper on settings screen ("Tax rules as of 2026-04-01") for transparency.

## Consequences

**Positive:**
- Single authority for compliance — no feature divergence.
- Rules are versionable + auditable — tax/regulation changes don't require feature rewrites.
- Semgrep + code-review + test suite catch "forgot to call the gate" before prod.
- Clear separation between "what's mandatory" (platform-controlled rules) vs "what's configurable" (shopkeeper-editable settings).

**Negative / trade-offs:**
- Every money-touching feature depends on `packages/compliance` — any bug there is widely-blast-radius; mitigated by comprehensive tests + code review.
- Rule versioning adds complexity; most rules change rarely but the mechanism must work correctly first time (migration from v1 to v2 is a designed event).

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Inline compliance checks in each feature** | Divergence inevitable; 5 feature modules implementing GST = 5 chances of bug; Agency non-negotiable |
| **Rules engine (e.g., json-rules-engine)** | Overkill for MVP's rule set; runtime rule parsing adds perf cost + indirection; simple TS functions are clearer |
| **SaaS compliance-as-a-service (Avalara, TaxJar)** | None offer India jewellery-native coverage; data-residency issues; vendor lock-in for a moat-feature |
| **Compliance rules as DB configuration only** | Loses TypeScript type safety; harder to test; `rules-versioning.ts` hybrid approach gives us configuration + types |

## Implementation Notes

### Example — `enforce269ST`

```ts
// packages/compliance/src/cash-cap/section-269st.ts
const SECTION_269ST_CAP_PAISE = 19999900n; // Rs 1,99,999 in paise

export async function enforce269ST(params: {
  tenantId: string;
  customerId: string;
  cashIncrementPaise: MoneyInPaise;
  getTodaysCashForCustomer: (customerId: string) => Promise<MoneyInPaise>;
}) {
  const todaysCash = await params.getTodaysCashForCustomer(params.customerId);
  const projectedTotal = todaysCash + params.cashIncrementPaise;
  if (projectedTotal >= SECTION_269ST_CAP_PAISE) {
    throw new ComplianceHardBlockError({
      errorCode: 'compliance.cash_cap_exceeded',
      messageKey: 'compliance.cash_cap.title',
      detail: {
        capPaise: SECTION_269ST_CAP_PAISE,
        todaysCashPaise: todaysCash,
        incrementPaise: params.cashIncrementPaise,
      },
      allowedOverridePath: '/api/v1/billing/override-cash-cap',
    });
  }
}

export async function override269ST(params: {
  ctx: TenantContext;
  invoice: Invoice;
  justification: string;
  approverUserId: string;
}) {
  if (!hasRole(params.ctx.role, 'OWNER' | 'MANAGER')) {
    throw new ForbiddenException('compliance.override.role_required');
  }
  await auditLog({
    ctx: params.ctx,
    action: 'COMPLIANCE_OVERRIDE_269ST',
    subjectType: 'Invoice',
    subjectId: params.invoice.id,
    metadata: { justification: params.justification, approverUserId: params.approverUserId },
  });
}
```

### Example — `trackPmlaCumulative` (transactional)

```ts
// packages/compliance/src/pmla/cumulative.ts
const PMLA_WARN_PAISE = 80000000n;   // Rs 8,00,000
const PMLA_BLOCK_PAISE = 100000000n; // Rs 10,00,000

export async function trackPmlaCumulative(params: {
  tx: DrizzleTx;
  ctx: TenantContext;
  customerId: string;
  month: string; // 'YYYY-MM'
  cashIncrementPaise: MoneyInPaise;
}): Promise<{ cumulativePaise: MoneyInPaise; threshold: 'none' | 'warn' | 'block' }> {
  const { tx, ctx, customerId, month } = params;
  // Upsert aggregate
  const [row] = await tx.execute(sql`
    INSERT INTO pmla_aggregates (shop_id, customer_id, month, cash_paise)
    VALUES (${ctx.shopId}, ${customerId}, ${month}, ${params.cashIncrementPaise})
    ON CONFLICT (shop_id, customer_id, month)
    DO UPDATE SET cash_paise = pmla_aggregates.cash_paise + EXCLUDED.cash_paise
    RETURNING cash_paise
  `);

  const cumulative = BigInt(row.cash_paise);
  if (cumulative >= PMLA_BLOCK_PAISE) {
    throw new ComplianceHardBlockError({
      errorCode: 'compliance.pmla_threshold_blocked',
      messageKey: 'compliance.pmla.block',
      detail: { cumulativePaise: cumulative, customerId, month },
    });
  }
  if (cumulative >= PMLA_WARN_PAISE) {
    // Emit event; shopkeeper gets warning notification
    return { cumulativePaise: cumulative as MoneyInPaise, threshold: 'warn' };
  }
  return { cumulativePaise: cumulative as MoneyInPaise, threshold: 'none' };
}
```

## Revisit triggers

- GST rate officially changes (government notification) — activate new `compliance_rules_versions` row with transition plan.
- Rule 32(5) Margin Scheme AAR conflict resolved — enable `margin-scheme.ts` as opt-in per tenant.
- New compliance surface emerges (e.g., revised BIS rules) — add module under `packages/compliance/src/`.

## References

- PRD §Domain Requirements, FR41–55, NFR-C1–9
- Architecture §Patterns Compliance hard-block pattern
- CLAUDE.md non-negotiable rule #3
