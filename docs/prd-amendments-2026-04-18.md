# PRD amendments — 2026-04-18

This file carries per-story amendments to `_bmad-output/planning-artifacts/prd.md` without
rewriting the PRD (ADR-0015 deferred-documentation policy).

## NFR-S5 — Session token (amended via ADR-0016)

**Previous wording:** "15-minute access JWT signed RS256 + 30-day refresh token stored in Redis."
**New wording:** "Vendor-managed session token via Firebase Auth. ID token TTL ~1hr (Firebase
default); refresh token persisted by Firebase SDK in native Keystore; revocation via Firebase
Admin SDK `revokeRefreshTokens(uid)` + `tokensValidAfterTime` check in the JWT guard."
**Revisit trigger:** compliance audit demands <15min TTL.

## NFR-A6 — Typography

TBD — finalized in PR 1.1b (Task 22).

## NFR-C7 — Data residency

TBD — finalized in PR 1.1b (Task 22) — documents Firebase Auth global-control-plane residual.
