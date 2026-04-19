# 0016 — Firebase Auth ID tokens direct (supersedes NFR-S5 own-JWT assumption)

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Alok (Principal Architect), Claude (Opus 4.7) as planning counterpart
**Supersedes:** NFR-S5 wording ("15min access / 30d refresh") in _bmad-output/planning-artifacts/prd.md
**Informs:** _bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md

## Context

ADR-0015 locked Firebase Auth as the MVP phone-OTP provider. PRD NFR-S5 predates that
decision and stipulates "15-minute access JWT signed RS256 + 30-day refresh token stored in
Redis". Story 1.1 is the first auth-consuming story and must reconcile these.

Two implementation paths were considered:

**Option A — wrap Firebase with our own JWT layer.** Verify Firebase ID token at /auth/session,
issue our own 15min RS256 access + 30d refresh; refresh stored in Redis; expire via Redis TTL.
Adds ~300 LOC, a Redis dependency ($16/mo when provisioned), a refresh endpoint, a refresh
rotation scheme, and an own-secret surface. Buys: fine-grained TTL control, revocation-via-
delete.

**Option B — use Firebase ID tokens directly.** Clients present Firebase ID tokens to the API;
server verifies via Admin SDK `verifyIdToken(token, checkRevoked=true)`; Firebase SDK manages
refresh in native Keystore (~1hr ID-token TTL, Firebase-managed refresh). No Redis, no refresh
table, no own-JWT code. Revocation via `revokeRefreshTokens(uid)` + `tokensValidAfterTime`
check in the guard.

## Decision

**Option B.** Firebase ID tokens are the authoritative session token. NFR-S5 is amended to
"vendor-managed session token with vendor-default TTL (~1hr); refresh managed by Firebase SDK
in native Keystore; revocation via Firebase Admin SDK `revokeRefreshTokens`."

## Consequences

**Positive:**
- Zero net new auth code (beyond the verify path Story 1.1 needs anyway).
- No Redis in MVP (aligns with ADR-0015 startup-lean).
- No own-secret surface to rotate or leak.
- Matches Firebase's documented integration pattern; fewer surprises.

**Negative / trade-offs:**
- TTL is Firebase-vendor-controlled (~1hr, configurable only via Identity Platform paid upgrade).
- Up to ~1hr lag on custom-claim propagation (mitigated by `requires_token_refresh` + client
  force-refresh on first login).
- Revocation requires an Admin SDK call, not a Redis delete.

## Revisit triggers

- Compliance audit demands <15min session TTL → upgrade to Identity Platform ("Firebase Auth
  Plus") with custom session cookie flow, OR switch to Option A wrapper.
- Cross-vendor portability becomes a requirement → Option A provides vendor abstraction.

## Amendment to PRD NFR-S5

PRD NFR-S5 text is updated via `docs/prd-amendments-2026-04-18.md` (committed in Story 1.1, PR
1.1b), per ADR-0015's deferred-documentation pattern.

## Threat model

Adds mitigation S1-M13 (Firebase custom-claim integrity): only the server writes custom claims
via Admin SDK; clients cannot forge; every verify checks `checkRevoked=true`.
