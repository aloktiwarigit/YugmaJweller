---
story: <STORY-ID> — <Story Title>
class: <A | B | C>
date: <YYYY-MM-DD>
pre-flight-done: false
---

# <STORY-ID>: <Story Title>

> **Class:** <A|B|C>  
> **Epic:** <E-N>  
> **PRD FRs:** <FR-XX, FR-YY>

## Pre-Flight Checklist (run before WS-B first commit)

```bash
pnpm --filter packages/shared build         # compile shared types first
pnpm lint --fix                              # surface type drift early
semgrep --config ops/semgrep/ .             # catch security patterns before code
```

Manual trace (fill in before coding):
- Entity fields: `<entity>` → `<CreateDto>` → `<service param>` → `<ResponseDto>`
- Audit log fields: **no PII** — check: phone, pan, aadhaar masked?
- `shop_id` source: **always from `TenantContext`**, never from request body
- Role guard placement: controller method (not service)

---

## Work Streams

> Drop work streams that don't apply. WS-A always runs first. WS-C and WS-D run in parallel after WS-B. WS-E runs last.

### WS-A: Data Layer
**Packages:** `packages/db`, `packages/shared`  
**Parallel with:** nothing — runs first  
**Done when:** migration applies cleanly; Zod schemas compile; shared types export correctly

- [ ] Migration SQL (`migration-NNNN-<name>.sql`)
  - Table columns with correct types (DECIMAL not FLOAT for weights/money)
  - RLS policy: `CREATE POLICY ... USING (shop_id = current_setting('app.shop_id')::uuid)`
  - Indexes for tenant-scoped queries
- [ ] Drizzle schema (`packages/db/src/schema/<table>.ts`)
- [ ] Shared Zod schemas + TypeScript types (`packages/shared/src/<feature>/`)
- [ ] Unit tests for schema constraints (weight precision, enum values, required fields)

**Commit message:** `feat(db): <feature> schema + migration NNNN`

---

### WS-B: API Layer
**Packages:** `apps/api` (modules/<feature>), `packages/audit`  
**Depends on:** WS-A complete  
**Parallel with:** nothing — WS-C/WS-D start after this  
**Done when:** integration tests green; tenant-isolation test passes; audit events fire

- [ ] Repository (`<feature>.repository.ts`)
  - Tenant-scoped queries (shop_id from TenantContext, never from body)
  - Register endpoint in tenant-isolation walker (`ops/tenant-isolation/walker.ts`)
  - Repository unit tests with mock DB
- [ ] Service (`<feature>.service.ts`)
  - Business logic, compliance gate calls (if applicable)
  - Audit event emission (`this.auditService.log(...)`)
  - Service unit tests
- [ ] Controller (`<feature>.controller.ts`)
  - Role guard: `@UseGuards(FirebaseAuthGuard, RolesGuard)` + `@Roles(...)`
  - HTTP status codes (201 for create, 200 for get/patch, 204 for delete)
  - i18n keys for all user-facing messages
- [ ] Module wiring (`<feature>.module.ts` + `app.module.ts` import)
- [ ] Integration tests (Testcontainers): happy path + 401/403/404/409 + tenant isolation

**Commit message:** `feat(api): <feature> repo + service + controller`

---

### WS-C: Security & Gates
**Packages:** `ops/semgrep/`, `ops/tenant-isolation/`  
**Depends on:** WS-B complete  
**Parallel with:** WS-D  
**Done when:** Semgrep rules added for new invariants; walker covers all new endpoints

- [ ] Semgrep rules for new invariants (e.g., `no-<feature>-from-body`)
- [ ] Tenant-isolation walker: all new endpoints registered with expected 403 on wrong tenant
- [ ] Security pre-flight verification:
  - Phone/PAN/aadhaar fields masked in audit log
  - No `shop_id` from request body in any new DTO
  - Role guard on every non-public endpoint

**Commit message:** `feat(security): semgrep rules + tenant-isolation for <feature>`

---

### WS-D: Mobile UI *(drop if API-only story)*
**Packages:** `apps/shopkeeper`, `packages/ui-mobile`  
**Depends on:** WS-B complete (API contract locked)  
**Parallel with:** WS-C  
**Done when:** screen renders; golden-path tap flow works on emulator; Hindi i18n displays

- [ ] UI primitive/component additions to `packages/ui-mobile` (if needed)
- [ ] Screen (`apps/shopkeeper/src/screens/<Feature>Screen.tsx`)
  - NativeWind classes; ≥48dp touch targets; 16pt minimum font
  - Hindi strings in `apps/shopkeeper/src/i18n/hi-IN/<feature>.json`
  - English strings in `apps/shopkeeper/src/i18n/en-IN/<feature>.json`
- [ ] TanStack Query hooks (`useGet<Feature>`, `useUpdate<Feature>`)
- [ ] Navigation wiring (if new screen)
- [ ] Component tests (React Native Testing Library)

**Commit message:** `feat(shopkeeper): <feature> screen + i18n`

---

### WS-E: Review Gate
**Depends on:** WS-B + WS-C + WS-D all complete  
**Done when:** both markers written; smoke test passed; CI green

- [ ] **Pre-flight run** (final): `pnpm typecheck && pnpm lint && pnpm test`
- [ ] **Codex:** `codex review --base main` → write `.codex-review-passed`
- [ ] **Security review** *(Class A only)*: `/security-review` → write `.security-review-passed`
  - Run in parallel with Codex — do not wait for Codex to finish first
- [ ] **Runtime smoke test:**
  - Shopkeeper story: Metro boot + golden-path tap flow on emulator
  - API-only story: `curl -H "Authorization: Bearer $TOKEN" <endpoint>` round-trip
  - Web story: browser render + golden-path flow
- [ ] `git push`

---

## Acceptance Criteria Traceability

| AC | Work Stream | Test Coverage |
|----|-------------|---------------|
| AC-1: ... | WS-B integration | `<test file>:<line>` |
| AC-2: ... | WS-D component | `<test file>:<line>` |

---

## Reclassification Gate

> If mid-execution you discover a Class A surface (new API endpoint touching money/auth/RLS, a new compliance gate, or a migration touching SECURITY DEFINER) — **STOP**. Reclassify to Class A, add WS-C security review, restart with fresh session for WS-B onward.
