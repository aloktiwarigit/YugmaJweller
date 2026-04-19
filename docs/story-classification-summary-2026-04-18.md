---
title: Story Classification Summary (Class A / B / C)
date: 2026-04-18
author: classification sweep per CLAUDE.md §"Ceremony tiering per story (A / B / C) — 2026-04-18"
scope: all 138 stories across 16 epics (E1–E16)
---

# Story Classification Summary — 2026-04-18

Every story in `_bmad-output/planning-artifacts/epics-*.md` now carries a `**Class:** {A|B|C}` tag beneath its heading. This document is the index / audit trail for that sweep. Reference the per-epic files for full rationale; this file only totals, distributions, and elevation notes.

## Totals

| Class | Count | Share |
|-------|-------|-------|
| A (incl. 1 grandfathered — Story 1.1) | 46 | 33.3% |
| B | 82 | 59.4% |
| C | 10 | 7.2% |
| **Total** | **138** | 100% |

Distribution falls inside the CLAUDE.md expected band (A ~25-35%, B ~50-60%, C ~10-15%). Class C trends slightly below the band because most copy/doc-only work lives in PRD/UX files, not epic stories; epic stories tend to carry at least a feature-surface delta.

## Breakdown by epic

| Epic | Stories | A | B | C | Notes |
|------|--------:|--:|--:|--:|-------|
| E1 — Auth + staff + audit | 7 | 7 | 0 | 0 | Entire epic on auth surface, as expected. |
| E2 — Shop self-service settings | 9 | 0 | 9 | 0 | All stories land on shop_settings / tenant-config, no compliance/auth surfaces. |
| E3 — Inventory | 10 | 3 | 7 | 0 | Stories 3.1 (HUID validate), 3.6 (offline-sync foundation), 3.8 (stock ledger / PMLA 5-yr immutable) elevated A. |
| E4 — Gold-rate pricing | 6 | 2 | 2 | 2 | 4.1 (rates adapter foundation) + 4.5 (money + GST formula) are A; 4.3/4.6 are read-only / animation C. |
| E5 — Billing + compliance | 13 | 10 | 3 | 0 | Compliance-heavy; matches CLAUDE.md expectation. Only 5.2 (reads settings), 5.10 (WhatsApp share), 5.12 (GSTR CSV export) stay B. |
| E6 — CRM | 9 | 2 | 5 | 2 | 6.1 (PII encrypt + DPDPA schema) + 6.8 (DPDPA delete w/ PMLA override) A; 6.7 (search) + 6.9 (consent-schema stub) C. |
| E7 — Customer-web (parts 1 + 2) | 20 | 2 | 18 | 0 | Only 7.2 (customer OTP auth) and 7.7 (HUID QR → BIS verify) hit A. Rest are safe catalog / UI surfaces. |
| E8 — Loyalty | 5 | 1 | 3 | 1 | 8.3 (redemption passes compliance gate) A; 8.5 (tier celebration UI) C. |
| E9 — Rate-lock | 5 | 3 | 2 | 0 | 9.1, 9.3, 9.4 all hit money + Razorpay webhook + compliance. |
| E10 — Try-at-home | 4 | 1 | 2 | 1 | Only 10.4 (purchase outcome → invoice) A. 10.1 (feature-flag conditional render) C. |
| E11 — Custom-order | 8 | 3 | 5 | 0 | 11.1 (entry + DECIMAL weight), 11.3 (deposit webhook), 11.8 (final invoice) A. |
| E12 — Customer recognition | 6 | 1 | 4 | 1 | 12.1 (DPDPA consent gate) A; 12.3 (anonymous tracking, no PII) C. |
| E13 — Notifications | 10 | 1 | 9 | 0 | Only 13.6 (PMLA push-alert event) A; all outbound send stories stay B. |
| E14 — Dashboards + reports | 8 | 0 | 8 | 0 | Pure reporting via read replica; no compliance enforcement, no money primitives. |
| E15 — Platform admin | 12 | 10 | 2 | 0 | platform_admin surface → almost all A. Only 15.3 (theme wizard) + 15.4 (feature-flag CRUD) stay B. |
| E16 — Go-live hardening | 6 | 0 | 3 | 3 | Load tests + P1 SLA + PostHog telemetry = B; runbook / pentest report / sign-off ceremony = C. |
| **Total** | **138** | **46** | **82** | **10** | |

## Story 1.1 grandfathering

Story 1.1 is tagged `A (grandfathered — uniform ceremony)`. The policy pins it on pre-tiering full-ceremony rules. No retroactive down-class.

## Ambiguous / flagged stories

None. No story was flagged for human review; every classification resolved from path + AC signals.

## Elevation notes (stories where a judgment call was made)

These are the cases where the sweep consciously elevated above the narrow path heuristic. Listing here so the classification can be audited.

### B → A elevations

- **3.1 (create product)** — elevated because HUID validate is compliance, and the story also writes audit events + introduces RLS migration.
- **3.6 (offline-sync foundation)** — elevated because the protocol carries customer/invoice/product mutations and correctness underpins every tenant-scoped write; correctness failure = silent cross-tenant leakage risk.
- **3.8 (stock movements ledger)** — elevated because the ledger is PMLA 5-year immutable and introduces pessimistic locking semantics.
- **4.1 (IBJA rates adapter)** — elevated because every downstream pricing / invoice / compliance-GST calc flows through this adapter's cache + fallback chain.
- **4.5 (price formula)** — elevated because it's where `packages/money` and `packages/compliance/gst` meet with the weight-precision harness.
- **6.1 (create customer)** — elevated because PAN/KYC are PII-encrypted via `packages/security` and the story introduces the DPDPA retention schema.
- **6.8 (DPDPA deletion)** — elevated because the workflow has to honour PMLA retention override on invoices / KYC / HUID while soft/hard-deleting everything else.
- **8.3 (loyalty redemption)** — elevated because the redemption line passes through the compliance gate on invoice totals (redemption can cross 269ST / PAN thresholds).
- **10.4 (booking outcome — purchased)** — elevated because the "purchased" branch triggers Epic 5 invoice creation with full compliance gate chain (PAN ≥ Rs 2L + 269ST cash cap).
- **11.1 (custom-order entry)** — elevated because it introduces DECIMAL(12,4) weight on a custom-order line and is the entry point to a money-heavy flow (deposit → final invoice).
- **11.8 (final custom-order invoice)** — elevated because it's an invoice with deposit pull-through, both money path + compliance gates.
- **12.1 (viewing consent gate)** — elevated because DPDPA consent is a compliance hard-block: no FR64 processing may occur without it, and the story also handles retroactive anonymization.
- **13.6 (shopkeeper push for PMLA etc.)** — elevated specifically because the story handles the PMLA threshold-crossed event; even though dispatch is safe, the event boundary is compliance-touching.
- **15.11 (subscription-plan management)** — elevated because plan assignment + grace-period override is a cross-tenant platform_admin operation affecting every tenant's billing state.

### C → B elevations

- None recorded. All Class C picks landed cleanly under the heuristic (copy-only, read-only chart, animation-only moment, schema stub, doc-only runbook / pentest / sign-off).

### Calls consciously kept at B (NOT elevated to A)

- **5.2 (billing reads making-charge defaults from settings)** — kept B: read-only consumer of tenant-config; no new compliance gates introduced.
- **5.10 (WhatsApp invoice share)** — kept B: non-compliance invoice output; send via integration adapter from BullMQ.
- **5.12 (GSTR CSV export)** — kept B: compliance gates (GST split / HUID / PAN / 269ST / PMLA) all enforced upstream at invoice creation; the export itself is read-only.
- **9.5 (rate-lock confirmation notification)** — kept B: outbound WhatsApp + push only; no money / auth touched in this story.
- **13.1 (outbound WhatsApp invoice receipt)** — kept B: outbound send from BullMQ, not an inbound webhook. Policy reserves A for inbound webhook signature verification.
- **15.3 (theme wizard)** and **15.4 (per-tenant feature flags)** — kept B: platform_admin-adjacent but the surfaces themselves are non-sensitive config CRUD.

## How to use this classification

- When starting a new story, look up its class here (or re-read the tag under its heading).
- Class A → follow the full 5-layer review gate from CLAUDE.md §"Per-Story Protocol".
- Class B → 3-layer gate (code-review + Codex + superpowers:requesting-code-review).
- Class C → Codex CLI only; inline single-session execution permitted.
- **If a Class B or C story reveals mid-execution that it's touching a Class A surface, stop and reclassify**: better to add the missing ceremony than to merge under the wrong gate.
- **Mixed PRs containing both A and B files are Class A for the whole PR.** Split when practical to keep B-class work out of A-class ceremony.

## Verification

All 9 epic files re-verified post-edit: `grep -c "^### Story"` equals `grep -c "^\*\*Class:\*\*"` per file (18 / 18 / 16 / 16 / 13 / 14 / 10 / 10 / 23 = 138 both sides). No orphan story headings, no double-tagged stories.

## Change ledger

- 2026-04-18 — initial sweep across all 16 epics following the Ceremony tiering policy committed same day. Story 1.1 preserved under grandfather clause; E2-S1 (not yet in epics file as a tagged story) retains its pre-existing full-ceremony status until authored.
