# PRD amendments — 2026-04-18

This file carries per-story amendments to `_bmad-output/planning-artifacts/prd.md` without
rewriting the PRD (ADR-0015 deferred-documentation policy).

## NFR-S5 — Session token (amended via ADR-0016)

**Previous wording:** "15-minute access JWT signed RS256 + 30-day refresh token stored in Redis."
**New wording:** "Vendor-managed session token via Firebase Auth. ID token TTL ~1hr (Firebase
default); refresh token persisted by Firebase SDK in native Keystore; revocation via Firebase
Admin SDK `revokeRefreshTokens(uid)` + `tokensValidAfterTime` check in the JWT guard."
**Revisit trigger:** compliance audit demands <15min TTL.

## NFR-A6 — Typography (finalized — PR 1.1b)

**Previous wording:** "Noto Sans Devanagari for Hindi; Hind / Mukta fallbacks."
**New wording:** "Direction 5 typography stack — **Yatra One** (display, Devanagari) + **Mukta Vaani**
(body, weights 400/500/600/700) + **Tiro Devanagari Hindi** (serif, regular + italic) + **Fraunces**
(Latin display italic, sparingly). Mukta Vaani is a design-goal superset of Noto Sans Devanagari.
All four families bundled via `expo-font` (NOT Google Fonts CDN — invariant 24). SIL Open Font
License for all four."
**Rationale:** Customer-aspirational design direction v2 locked Direction 05 (Hindi-First Editorial)
as the anchor's baseline; this story is the first surface to apply it.

## NFR-C7 — Data residency (finalized — PR 1.1b)

**Previous wording:** "All customer data stored in ap-south-1 (Mumbai)."
**New wording (per ADR-0015 + ADR-0016):** "All customer data stored in **Azure Central India (Pune)**
or **Azure South India (Chennai)** — locked by ADR-0015. **Firebase Auth control plane is global**;
SMS origination from India; user records pinned to `asia-south1` when the project is upgraded to
Identity Platform (post-anchor-SOW). Residual accepted until the Identity-Platform upgrade trigger
(compliance audit demands region-pinned user records OR anchor SOW signs + cost gate passes)."
**Residual acknowledgment:** Firebase Auth's global control plane is an accepted pre-paying-tenant
residual. Documented so audit trails capture the exposure; mitigated by Identity Platform upgrade
post-SOW.
