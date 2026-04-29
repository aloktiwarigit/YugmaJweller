# 0001 — Auth Provider: Supabase Auth (Mumbai) for Phone OTP

**Status:** Superseded in part by ADR-0015 (2026-04-18) — primary auth provider swapped to Firebase Auth for startup-lean MVP. Supabase Auth moves to "alternatives considered" in ADR-0015. Full rewrite deferred to Story 1.1 (auth) when infrastructure story lands.
**Date:** 2026-04-17
**Deciders:** Winston (Architect), John (PM), Alok (Agency)
**Consulted:** Murat (Test Architect on OTP rate-limit semantics), Mary (BA on legal/residency)

## Context

Goldsmith authenticates three user classes — shopkeeper staff, customers, and platform admin — across four apps. PRD FR8–15 + NFR-S4 + NFR-S5 + NFR-C7 (data residency in India) drive the requirements:

- Phone OTP primary (no passwords) for shopkeeper + customer; SMS via MSG91 (India) with optional WhatsApp delivery via AiSensy later.
- JWT sessions with short-lived access + rotating refresh tokens.
- Multi-factor authentication for platform admin role.
- Custom JWT claims (`shop_id`, `role`, `aud`) for multi-tenant + multi-app scoping.
- Data residency: user records + auth logs must stay in India (DPDPA + RBI guidance).
- OTP rate-limits (5 per phone / 15 min; lockout after 10 failed verifies).
- Adapter-swappability — auth is a vendor, not a religion.

## Decision

Use **Supabase Auth** (open-source; self-hostable in Mumbai OR Supabase Cloud's India region when it launches production tier). Wrap via `packages/integrations/auth/supabase-auth-adapter` implementing `AuthPort`. SMS OTP delivered via MSG91 adapter (Supabase's custom SMS provider hook).

## Consequences

**Positive:**
- Production-ready phone OTP flow out of the box; no bespoke OTP state machine to implement + secure.
- JWT RS256 signing + custom claims supported natively.
- Integrates cleanly with PostgreSQL — Supabase ships `auth.users` schema and helper functions usable from our Drizzle-managed DB; keeps auth + tenant tables in one store.
- MFA support for platform admin role via `authenticator` app TOTP.
- Open-source option means we can self-host in Mumbai for strict residency.
- Refresh-token rotation + server-side revocation list (Redis-backed) built-in.

**Negative / trade-offs:**
- If we self-host, we take on ops burden (Postgres, Redis, deployment); if we use Supabase Cloud, we need a signed DPA and India-region confirmation.
- Some Supabase Auth features (magic links, OAuth social providers) we don't need for MVP — small overhead.
- Coupling Supabase's Postgres schema (`auth.*`) to our DB means migrations must respect Supabase's ownership of that schema.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Firebase Auth** | Google-cloud lock-in; data residency for India is limited; OTP quotas + pricing at scale; JWT customization less flexible |
| **AWS Cognito** | Poor DX; complex user-pool model; OTP via SNS is expensive + opaque rate-limit behaviour; MFA flow is clunky; custom claims via triggers is heavy |
| **Auth0** | Cost scales aggressively; residency for India is paid-tier enterprise; vendor dependency |
| **Build in-house** | OTP + rotation + rate-limit + recovery + MFA are not commodity problems; security risk disproportionate to savings |
| **Clerk** | Newer; less mature India/multi-tenant story; phone-OTP UX is secondary focus for them |
| **Ory Kratos** | Self-host is heavier than Supabase; smaller community; less prescriptive defaults |

## Implementation Notes

- `packages/integrations/auth/supabase-auth-adapter.ts` implements: `sendOtp(phone)`, `verifyOtp(phone, code) → { accessToken, refreshToken, user }`, `refresh(refreshToken)`, `revoke(refreshToken)`, `getUser(userId)`.
- SMS delivery via Supabase's custom-SMS-provider hook pointing to `MSG91` adapter.
- Platform admin role uses `authenticator` app TOTP (Supabase MFA) in addition to phone OTP.
- Refresh-token revocation list lives in Redis with `refresh:<jti>` TTL.
- Audit log via `packages/audit` on every login / logout / role change / MFA enroll.

## Revisit triggers

- Supabase Cloud's India tier becomes unavailable or DPA unsigned → migrate to self-host Mumbai.
- OTP delivery failure rate > 2% sustained → add AiSensy WhatsApp OTP as dual-channel.
- User count exceeds Supabase performance envelope → evaluate extraction.

## References

- PRD §10 FR8–15, §11 NFR-S4, NFR-S5, NFR-C7
- Architecture doc §Core Architectural Decisions / Authentication & Security
