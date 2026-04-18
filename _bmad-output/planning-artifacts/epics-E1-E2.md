---
generatedBy: 'bmad-agent-dev + bmad-agent-architect (Amelia + Winston collaboration)'
epic: 'E1 + E2'
date: '2026-04-17'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
  - _bmad-output/planning-artifacts/adr/0002-multi-tenant-single-db-rls.md
  - _bmad-output/planning-artifacts/adr/0003-money-weight-decimal-primitives.md
  - _bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
  - _bmad-output/planning-artifacts/adr/0009-monorepo-modular-monolith-layout.md
  - _bmad-output/planning-artifacts/adr/0010-tenant-provisioning-automation.md
  - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
  - _bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
  - _bmad-output/planning-artifacts/prd.md (FR1-FR24, NFR-S*, NFR-P*, NFR-A*, NFR-C*)
  - _bmad-output/planning-artifacts/ux-design-specification.md (UX-DR1-7, UX-DR18-22, UX-DR28-30)
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Story 1.7 (sign-out from all devices) was retained as a standalone story, not merged into 1.1,
    because (a) the multi-device session-revocation flow is non-trivial Redis + JWT logic and (b)
    bundling it into 1.1 would push Story 1.1 past the XL complexity ceiling. The total Epic 1
    story count is 7 (including 1.7).
  - >
    Epic 2 stories (2.1-2.9) all depend on the `settings` module + `shop_settings` table + Redis
    settings cache introduced in Story 2.1. Each subsequent story only creates/alters the settings
    column(s) it owns. The SettingsGroupCard component is introduced once in Story 2.1 and reused
    in all subsequent stories.
  - >
    NFR-P6 (30-sec propagation SLA) is verified in all Epic 2 stories via a stub of the
    customer-facing surface (a controlled test endpoint that reads from shop_settings). Full
    customer-facing read path ships in Epic 7.
---

---

## Epic 1: Shop Owner can create an account, invite staff, and reach their shop dashboard

**Goal:** A jeweller owner signs up via phone OTP on the shopkeeper app, sees their branded empty-state shop dashboard in Hindi, invites staff with appropriate roles — all on a greenfield monorepo that is fully testable, CI-gated, and tenant-isolated from Day 1.

**FRs covered:** FR1 (tenant create — seeded by platform admin offline for anchor MVP), FR5 (tenant isolation invariant), FR8, FR9 (OTP auth infrastructure — shopkeeper login in Epic 1; customer OTP reused from same adapter in Epic 7), FR10, FR11 (session persistence + logout), FR12 (staff invite), FR13 (role-based permissions), FR14 (revoke access), FR15 (auth audit trail)
**Phase:** Phase 0 — Sprint 1-2

---

### Story 1.1: Shop Owner reaches the empty shop dashboard in the app

**As a Shop Owner (Rajesh-ji, anchor jeweller, onboarding for the first time)**,
I want to open the shopkeeper app, verify my phone via OTP, and land on my shop's branded dashboard in Hindi,
So that I can start running my shop on the app instead of the paper daybook.

**FRs implemented:** FR8 (shopkeeper OTP login), FR10 (refresh-token session), FR5 (tenant-isolation foundation)
**NFRs verified:** NFR-S1 (TLS 1.3), NFR-S4 (OTP rate-limit 5/15min + lockout @10), NFR-S5 (15min access / 30d refresh), NFR-S7 (zero cross-tenant), NFR-S8 (tenant-isolation test from Sprint 1), NFR-S9 (auth audit), NFR-S10 (API rate-limit), NFR-C7 (data-residency Mumbai), NFR-A7 (48dp touch targets), NFR-A6 (Noto Sans Devanagari Hindi-first)
**Additional Requirements covered:** AR-1 (monorepo scaffold + enterprise floor + health endpoint + CI green), AR-2/3 (Terraform skeleton + data-residency tags), AR-4/5 (RLS on all tenant tables + tenant-isolation test suite ships), AR-7 (packages/money + packages/testing/weight-precision skeleton ships), AR-12 (Supabase Auth adapter), AR-15 (Sentry + OTel + PostHog baseline), AR-16 (CI: Semgrep + Snyk + Trivy + axe-core + Lighthouse CI + Codex gates)

**Modules + packages touched:**
- `apps/api/src/modules/auth/*` (new — OTP send/verify endpoints, JWT issue, refresh rotation)
- `apps/api/src/common/interceptors/tenant.interceptor.ts` (new — resolves shop_id from host/X-Tenant-Id/JWT claim)
- `apps/api/src/common/decorators/tenant-context.decorator.ts` (new)
- `apps/api/src/common/guards/tenant.guard.ts`, `role.guard.ts` (new)
- `apps/api/src/common/providers/db.provider.ts` (new — Drizzle with RLS SET LOCAL wrapper)
- `apps/api/src/common/filters/global-exception.filter.ts` (new — RFC 7807 problem+json)
- `packages/integrations/auth/supabase-auth-adapter.ts` (new — implements AuthPort: sendOtp, verifyOtp, refresh, revoke)
- `packages/integrations/sms-otp/msg91-adapter.ts` (new — MSG91 SMS delivery via Supabase custom SMS hook)
- `packages/db/src/schema/shops.ts` + `shop-users.ts` (new — with RLS policies in migration)
- `packages/db/src/migrations/0001_initial_schema.sql` (new — shops, shop_users, audit_events tables + RLS)
- `packages/security/jwt.ts` (new — RS256 verify + issue helpers)
- `packages/security/secrets.ts` (new — AWS Secrets Manager client)
- `packages/audit/src/logger.ts` + `actions.ts` (new — auditLog() helper + AuditAction enum)
- `packages/observability/src/*` (new — Sentry + OTel + Pino structured logger)
- `packages/money/src/*` (new — MoneyInPaise, Weight, Purity primitives; skeleton)
- `packages/compliance/src/*` (new — skeleton; gates to be fully implemented in Epic 5)
- `packages/testing/tenant-isolation/*` (new — 3-tenant harness, ships in this story)
- `packages/testing/weight-precision/*` (new — 10K harness skeleton, full data in Epic 3)
- `packages/i18n/locales/hi-IN/auth.json` + `common.json` (new)
- `packages/ui-tokens/src/*` (new — **Direction 5 tokens** locked 2026-04-17: aged-gold `#B58A3C` primary, terracotta blush `#D4745A` accent (sparingly), cream `#F5EDDD`, indigo ink `#1E2440`. Source: `design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/`. Older hex literals in acceptance criteria below are Direction C residue — resolve via ui-tokens package, do not use literals.)
- `packages/ui-mobile/primitives/*` (new — Tier 0: Button, Input, Toast, Skeleton; NativeWind-based)
- `apps/shopkeeper/app/(auth)/phone.tsx` + `otp.tsx` (new — phone entry + OTP verification screens)
- `apps/shopkeeper/app/(tabs)/index.tsx` (new — empty-state dashboard shell)
- `apps/shopkeeper/src/providers/AuthProvider.tsx` + `TenantProvider.tsx` (new)
- `infra/terraform/modules/*` (new — network, database, cache, compute, storage, secrets skeletons)
- `.github/workflows/ship.yml` (new — full CI pipeline from agency template)
- `ops/semgrep/*.yaml` (new — tenant-safety, money-safety, compliance-gates, theme-tokens rules)

**ADRs governing:** ADR-0001 (Supabase Auth), ADR-0002 (RLS), ADR-0005 (tenant context), ADR-0009 (monorepo), ADR-0012 (IaC Terraform)

**Pattern rules honoured:**
- MUST #1 — `shop_id UUID NOT NULL` + RLS policy on `shops`, `shop_users`, `audit_events`
- MUST #2 — all money/weight types are DECIMAL/BIGINT; no FLOAT anywhere (Semgrep enforces)
- MUST #5 — no raw `shopId` param in service signatures; TenantContext only (ESLint enforces)
- MUST #7 — no English-only UI strings; all auth copy in `packages/i18n/locales/hi-IN/auth.json`
- MUST #8 — tenant-isolation test suite ships in this story; runs on every CI; blocks merge on leak

**Complexity:** XL (greenfield foundation — scaffold + enterprise floor + auth + RLS + CI is one large story by design per IR-report §7)

---

**Acceptance Criteria:**

**Given** the monorepo is freshly scaffolded (Turborepo + pnpm + 4 apps + ~15 packages)
**When** `turbo run build` executes in CI
**Then** all apps and packages build without TypeScript errors (`tsc --noEmit` strict mode passes)
**And** `turbo run lint` returns zero errors
**And** `turbo run test` completes with ≥ 80% coverage on `packages/audit`, `packages/security`, `packages/money`, `packages/integrations/auth`
**And** the health endpoint `GET /api/v1/health` returns `{ status: "ok", env: "dev", version: "0.1.0" }` with HTTP 200
**And** `turbo run test:tenant-isolation` passes (3-tenant harness provisioned and assertions green)

**Given** the shopkeeper app is freshly installed and unopened on an Android mid-tier device (Xiaomi Redmi class)
**When** the shop owner opens the app for the first time
**Then** the phone-number entry screen renders within 2 seconds on 4G
**And** the screen displays in Hindi using Hind Siliguri font at 18px body size (senior-friendly per UX-DR7)
**And** a single phone-number input with `+91` prefix placeholder renders
**And** a primary "आगे बढ़ें" button with terracotta background (`#C35C3C`) renders at ≥ 48dp height with visible 2px terracotta-600 focus ring
**And** no English-only strings appear (Semgrep `require-i18n-key` rule passes)

**Given** the shop owner enters their registered phone number (+91 XXXXXXXXXX) and taps "आगे बढ़ें"
**When** the OTP send request fires
**Then** the client sends `POST /api/v1/auth/otp/send` with `{ phone: "+91XXXXXXXXXX" }` and `X-Tenant-Id` header
**And** the server invokes `SupabaseAuthAdapter.sendOtp()` which delivers OTP via MSG91 SMS
**And** the `audit_events` table records `{ action: "AUTH_OTP_SEND", tenant_id, user_agent, ip_address, created_at }` — immutable INSERT only
**And** the UI transitions to the 6-digit OTP entry screen within 250ms
**And** a resend timer "पुनः भेजें (00:60)" renders and counts down

**Given** the shop owner enters a correct 6-digit OTP
**When** the verify request fires
**Then** the server calls `SupabaseAuthAdapter.verifyOtp()` returning `{ accessToken, refreshToken, user }`
**And** the server issues a 15-minute RS256 access token with claims `{ sub, shop_id, role: "OWNER", aud: "shopkeeper", jti, iat, exp }`
**And** a 30-day single-use refresh token is persisted to Redis under `refresh:<jti>` with sliding TTL
**And** the `audit_events` table records `AUTH_LOGIN_SUCCESS` with immutable timestamp
**And** the client navigates to `(tabs)/index.tsx` (empty dashboard) within 1 second p95 on 4G
**And** the access token is stored in-memory (not persisted); the refresh token is stored in Android Keystore via Expo SecureStore

**Given** the shop owner is authenticated and on the dashboard for the first time
**When** the app renders the empty state
**Then** the shop's name and a generic placeholder logo render at the top of the screen
**And** the Hindi copy "आइए, अपना shop set up करें" renders in Hind Siliguri 20px
**And** a primary CTA "Staff जोड़ें" renders at ≥ 48dp height (wiring to Story 1.2)
**And** NO hex color literals appear in the component tree — all colors resolve via Direction C token references (Semgrep `theme-tokens` rule passes)
**And** no `shopId` string is passed as a raw parameter in any service call — TenantContext is the sole mechanism (ESLint `goldsmith/no-raw-shop-id-param` passes)

**Given** the shop owner enters an incorrect OTP 10 times within 15 minutes
**When** the 11th verify attempt is made from the same phone number
**Then** the server returns HTTP 429 with `{ errorCode: "auth.otp_rate_limited", retryAfterSeconds: 900 }`
**And** the UI displays Hindi message "बहुत अधिक प्रयास हो गए। कृपया 15 मिनट बाद पुनः प्रयास करें।"
**And** the attempt is audit-logged as `AUTH_OTP_RATE_LIMITED`

**Given** CI runs on the PR containing this story
**When** the pipeline executes `ship.yml`
**Then** tenant-isolation test suite passes: 3-tenant provisioning asserts zero cross-tenant read on every API endpoint implemented so far
**And** Semgrep rule `goldsmith/require-tenant-transaction` passes — every Drizzle transaction has `SET LOCAL app.current_shop_id`
**And** Semgrep rule `goldsmith/money-safety` passes — no FLOAT/REAL type anywhere in schema or application code
**And** Snyk + Trivy container scan report zero critical/high CVEs on merged deps
**And** axe-core accessibility scan on OTP screen reports zero WCAG AA violations
**And** Lighthouse CI performance score ≥ 90 on health endpoint response (placeholder)
**And** Codex CLI review passes (`codex review --diff HEAD~1` creates `.codex-review-passed` marker)
**And** coverage ≥ 80% on `packages/audit`, `packages/security/jwt`, `packages/integrations/auth`

---

**Tests required:**
- Unit: `SupabaseAuthAdapter.sendOtp()` (mock MSG91 response), `verifyOtp()` (valid + invalid OTP), JWT issuance (claims shape), JWT expiry, refresh-token Redis storage + rotation, `auditLog()` inserts correct fields
- Integration: OTP send → verify → dashboard load end-to-end against ephemeral Postgres (Testcontainers) with real Supabase Auth sandbox; RLS policy blocks cross-tenant SELECT on `shop_users`; `SET LOCAL` wrapper enforcement
- Tenant-isolation: 3-tenant harness — tenant A JWT cannot read tenant B's `shop_users` or `audit_events`; direct DB SELECT without `SET LOCAL` returns zero rows (RLS default-deny)
- Semgrep static: all 5 rules (tenant-safety, money-safety, compliance-gates, theme-tokens, secrets-scan) pass on codebase as committed
- E2E (Detox on Android emulator): full happy path — open app → enter phone → receive OTP (test OTP) → enter → reach dashboard; assert Hindi text renders correctly; assert no platform brand visible
- Accessibility (axe-core RN / Maestro): TalkBack reads "आगे बढ़ें button" in Hindi; focus order is phone → OTP → submit; error announced on invalid OTP

**Definition of Done:**
- All AC pass locally and in CI
- CI all gates green: typecheck, lint (ESLint + Prettier), test:unit, test:integration, test:tenant-isolation, Semgrep, Snyk, Trivy, axe-core, Lighthouse CI, Codex CLI, coverage ≥ 80%
- Storybook stories for: `Button` (primary/secondary/destructive), `Input` (default/error/disabled), `Toast` — each with Hindi + English + Direction C theme snapshots
- All 5 review layers passed: `/code-review`, `/security-review`, Codex CLI (`codex review --diff HEAD~1`), `/bmad-code-review`, `/superpowers:requesting-code-review`
- `.bmad-readiness-passed` marker exists at repo root
- Monorepo structure matches architecture §Project Structure exactly; no extra files or missing packages

---

### Story 1.2: Shop Owner invites a staff member by phone and assigns a role

**As a Shop Owner (Rajesh-ji)**,
I want to invite my son Amit by entering his phone number and assigning him the "Staff" role,
So that Amit can log in and handle billing while I'm away from the counter.

**FRs implemented:** FR12 (invite staff by phone + role)
**NFRs verified:** NFR-S9 (staff-invite audit-logged), NFR-A7 (48dp touch targets on invite form)
**Depends on:** Story 1.1 (auth module, tenant context, audit package)

**Modules + packages touched:**
- `apps/api/src/modules/auth/auth.service.ts` + `auth.controller.ts` (extend — add `POST /api/v1/auth/invite`)
- `apps/api/src/modules/auth/auth.repository.ts` (extend — insert into `shop_users` with status=INVITED)
- `packages/db/src/schema/shop-users.ts` (extend — add `status: TEXT CHECK (status IN ('INVITED','ACTIVE','REVOKED'))`, `invited_by_user_id`, `invited_at`, `activated_at` columns)
- `packages/db/src/migrations/0002_staff_invite.sql` (new migration)
- `packages/integrations/sms-otp/msg91-adapter.ts` (extend — send invite SMS with deep link)
- `packages/i18n/locales/hi-IN/auth.json` (extend — invite copy: "Staff को आमंत्रित करें")
- `apps/shopkeeper/app/settings/staff.tsx` (new — staff list + invite form screen)
- `apps/shopkeeper/src/features/settings/components/StaffInviteForm.tsx` (new)
- `packages/ui-mobile/composed/FormField.tsx` (new if not yet created — Tier 1 composed primitive)

**ADRs governing:** ADR-0001, ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1 (shop_users has shop_id + RLS), MUST #5 (TenantContext only), MUST #7 (Hindi-first), MUST #8 (tenant-isolation test extended)
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the Shop Owner is on the empty dashboard (Story 1.1 complete)
**When** the owner taps "Staff जोड़ें" primary CTA
**Then** the Staff Management screen opens showing a list header "आपके Staff (0)" and a "+ Staff जोड़ें" button at ≥ 48dp

**Given** the Shop Owner taps "+ Staff जोड़ें" and enters a phone number and selects role "Staff"
**When** the owner taps "आमंत्रण भेजें"
**Then** the client calls `POST /api/v1/auth/invite` with `{ phone: "+91XXXXXXXXXX", role: "STAFF" }` and TenantContext
**And** the server inserts a `shop_users` row with `{ shop_id, phone, role: "STAFF", status: "INVITED", invited_by_user_id, invited_at }`
**And** MSG91 SMS is dispatched to Amit's phone with a deep-link to the shopkeeper app and a message in Hindi: "राजेश जी की ज्वैलर्स शॉप में आपको Staff के रूप में आमंत्रित किया गया है। App download करें: [link]"
**And** the `audit_events` table records `STAFF_INVITED` with `{ subject_id: new_shop_user_id, before: null, after: { phone, role, status } }`
**And** the Staff list updates to show "Amit — Staff — आमंत्रित" with a pending indicator within 1 second (optimistic update)

**Given** the Shop Owner tries to invite the same phone number that is already an active staff member
**When** the form is submitted
**Then** the server returns HTTP 409 with `{ errorCode: "auth.staff_already_exists" }`
**And** the UI shows Hindi message "यह number पहले से staff में शामिल है।" inline below the phone field

**Given** the owner selects role "Manager" instead of "Staff"
**When** the invite is sent
**Then** the `shop_users` row has `role: "MANAGER"` and the audit log reflects the role assignment
**And** the SMS copy uses "Manager" role name

**Given** CI runs on this PR
**When** the tenant-isolation suite runs
**Then** a new test case asserts that tenant A's `POST /api/v1/auth/invite` cannot create a `shop_users` row visible to tenant B
**And** all prior tenant-isolation assertions still pass

---

**Tests required:**
- Unit: `AuthService.invite()` — creates invited shop_user row, dispatches SMS, emits audit event; duplicate-phone conflict returns 409
- Integration: invite flow end-to-end against ephemeral Postgres — assert `shop_users.status = 'INVITED'`, audit event inserted, MSG91 adapter mock called with correct payload
- Tenant-isolation: invited staff of tenant A not visible to tenant B's API calls
- E2E (Detox): Owner taps Staff → invite form → submit → list shows "आमंत्रित" row; Hindi SMS preview matches expected copy in test mode

**Definition of Done:**
- All AC pass; CI all gates green; Storybook story for `StaffInviteForm` (Hindi + English + error state); FormField Tier 1 component Storybook story added; all 5 review layers passed

---

### Story 1.3: Staff member logs in and sees a role-limited dashboard

**As a Staff member (Amit, 28, Rajesh-ji's son)**,
I want to open the shopkeeper app with my invited phone number, complete OTP verification, and land on a dashboard that shows only the features my Owner has given me access to,
So that I can do my job without accidentally touching restricted shop settings.

**FRs implemented:** FR9 (customer OTP auth — reused for staff login via same adapter), FR8 (shopkeeper OTP login for invited staff), FR10 (session persistence), FR13 (RBAC — role-limited view)
**NFRs verified:** NFR-S5 (15min access / 30d refresh), NFR-S7 (zero cross-tenant — staff of shop A cannot see shop B), NFR-A7 (48dp targets)
**Depends on:** Story 1.1 (auth module), Story 1.2 (staff invite — shop_users row must exist in INVITED status)

**Modules + packages touched:**
- `apps/api/src/modules/auth/auth.service.ts` (extend — staff OTP login activates INVITED shop_user; JWT claims include `role`)
- `apps/api/src/common/guards/role.guard.ts` (extend — RBAC guard reads `role` from TenantContext; `@Roles(['OWNER','MANAGER'])` decorator)
- `packages/db/src/schema/shop-users.ts` (extend — `activated_at` set on first login)
- `packages/i18n/locales/hi-IN/auth.json` (extend — "Staff login" copy)
- `apps/shopkeeper/app/(tabs)/index.tsx` (extend — conditionally render tabs/actions based on JWT `role`)
- `apps/shopkeeper/src/features/settings/` (extend — Settings tab hidden for STAFF role; visible for MANAGER + OWNER)
- `packages/ui-mobile/primitives/` (extend — no new primitives needed; reuse from 1.1)

**ADRs governing:** ADR-0001, ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #5, MUST #7, MUST #8 (tenant-isolation test extended with staff-login path)
**Complexity:** M

---

**Acceptance Criteria:**

**Given** Amit receives the invite SMS and opens the shopkeeper app for the first time
**When** he enters his phone number and completes OTP verification
**Then** the server finds his `shop_users` row with `status: "INVITED"` and activates it (`status = "ACTIVE"`, `activated_at = NOW()`)
**And** the issued JWT has claims `{ sub: amit_user_id, shop_id: rajesh_shop_id, role: "STAFF", aud: "shopkeeper" }`
**And** the `audit_events` table records `AUTH_LOGIN_SUCCESS` and `STAFF_ACTIVATED` events
**And** Amit lands on the dashboard showing his name "Amit — Staff" in the app header

**Given** Amit is authenticated with role "STAFF"
**When** the dashboard renders
**Then** the bottom navigation shows: Home, Billing, Inventory tabs
**And** the "Settings" tab does NOT appear (hidden for STAFF role)
**And** the "Reports" tab does NOT appear (hidden for STAFF role unless explicitly granted — default-off)
**And** the "Staff जोड़ें" CTA does NOT appear on Amit's dashboard

**Given** Amit attempts to call `GET /api/v1/settings` directly (e.g., via a crafted HTTP request)
**When** the API evaluates the request
**Then** the server returns HTTP 403 with `{ errorCode: "auth.forbidden", detail: "role 'STAFF' is not permitted for this resource" }`
**And** the attempt is logged to `audit_events` as `ACCESS_DENIED`

**Given** CI runs on this PR
**When** the tenant-isolation suite runs
**Then** a test case asserts: Amit's JWT (tenant A, STAFF role) calling any endpoint returns only tenant A data; calling `GET /api/v1/settings` returns 403 for STAFF role

---

**Tests required:**
- Unit: `AuthService.loginStaff()` — INVITED user activated on first login; ACTIVE user returns session; revoked user returns 401; JWT `role` claim set correctly
- Unit: `RoleGuard` — STAFF blocked on `@Roles(['OWNER'])` endpoint; MANAGER allowed on `@Roles(['OWNER','MANAGER'])` endpoint
- Integration: Staff invite → staff login → role-limited dashboard data — assert STAFF cannot reach settings endpoint; OWNER can
- Tenant-isolation: Staff of tenant A cannot access tenant B's endpoints even with a crafted `X-Tenant-Id` header
- E2E (Detox): Invite staff in shop, switch to staff device, login, verify Settings tab absent; verify Billing tab visible

**Definition of Done:**
- All AC pass; CI all gates green; all 5 review layers passed

---

### Story 1.4: Shop Owner configures permissions for each role

**As a Shop Owner (Rajesh-ji)**,
I want to open Settings → Staff & Permissions and customize what each role (Staff, Manager) can and cannot do — for example, allow Staff to create invoices but not void them, and allow Manager to view reports,
So that I maintain control without micromanaging every action.

**FRs implemented:** FR13 (Shop Owner configures per-role permissions)
**NFRs verified:** NFR-S9 (permission-change audit-logged)
**Depends on:** Story 1.1 (auth + audit), Story 1.2 (staff list), Story 1.3 (role guard reads DB)

**Modules + packages touched:**
- `apps/api/src/modules/auth/` (extend — `GET/PUT /api/v1/auth/roles/:role/permissions` endpoints)
- `packages/db/src/schema/role-permissions.ts` (new — `{ shop_id, role, permission_key, is_enabled, updated_at }` with RLS)
- `packages/db/src/migrations/0003_role_permissions.sql` (new migration with default permission matrix)
- `apps/api/src/common/guards/policy.guard.ts` (extend — reads `role_permissions` table via Redis-cached lookup instead of hardcoded RBAC)
- `packages/tenant-config/src/settings/` (new — `useSetting()` stub; permission cache layer)
- `packages/ui-mobile/business/SettingsGroupCard.tsx` (new — Tier 3 component; used in all Epic 2 stories)
- `apps/shopkeeper/app/settings/staff.tsx` (extend — "Permissions" toggle matrix per role)
- `packages/i18n/locales/hi-IN/settings.json` (new — Settings domain Hindi copy)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0009
**Pattern rules honoured:** MUST #1 (role_permissions has shop_id + RLS), MUST #3 (service emits domain event + auditLog on permission change), MUST #5 (TenantContext), MUST #7 (Hindi-first)
**Complexity:** M

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Staff & Permissions
**When** the screen loads
**Then** a permissions matrix renders showing 3 roles (Owner, Manager, Staff) across 6 permission categories: "बिल बनाएं" (create invoice), "बिल रद्द करें" (void invoice), "Inventory edit", "Settings edit", "Reports देखें" (view reports), "Analytics देखें"
**And** Owner permissions are shown as locked (all enabled, non-editable — greyed lock icon)
**And** Manager and Staff toggles are editable
**And** all labels are in Hindi; English names appear as small secondary text below

**Given** the Shop Owner toggles "Reports देखें" ON for Manager role and saves
**When** the save fires
**Then** the client calls `PUT /api/v1/auth/roles/MANAGER/permissions` with `{ permission_key: "reports.view", is_enabled: true }`
**And** a `role_permissions` row is upserted with `{ shop_id, role: "MANAGER", permission_key: "reports.view", is_enabled: true }`
**And** the Redis cache key `shop:{shop_id}:permissions:MANAGER` is invalidated
**And** `audit_events` records `PERMISSIONS_UPDATED` with `{ before: { permission_key, is_enabled: false }, after: { is_enabled: true } }`
**And** a toast "बदलाव सहेज लिया ✓" with medium haptic fires (per UX-DR20 feedback pattern)
**And** the next time any Manager calls `GET /api/v1/reports/daily`, the `PolicyGuard` grants access without needing an app restart

**Given** Amit (STAFF) attempts to access a permission he doesn't have (e.g., void invoice)
**When** the API evaluates `POST /api/v1/billing/invoices/:id/void`
**Then** the server checks `role_permissions` for `{ role: "STAFF", permission_key: "billing.void" }` and finds `is_enabled: false`
**And** returns HTTP 403 with `{ errorCode: "auth.permission_denied", permissionKey: "billing.void" }`
**And** the UI displays "आपको यह action करने की permission नहीं है।"

---

**Tests required:**
- Unit: `PolicyGuard.canActivate()` — reads cached then DB permissions; cache invalidation on update; OWNER bypass
- Unit: `SettingsGroupCard` component — renders toggle matrix; fires save callback; Hindi labels correct
- Integration: toggle permissions → Drizzle upserts `role_permissions` → policy guard denies old-permission call → old-permission call now allowed after toggle
- Tenant-isolation: tenant A's permission matrix changes do NOT affect tenant B's roles
- E2E (Detox): Owner changes Staff permissions → Amit's session (without restart) now reflects new permission on next API call

**Definition of Done:**
- All AC pass; CI gates green; `SettingsGroupCard` Tier 3 component has Storybook story (Hindi + English + 2-tenant-theme); all 5 review layers passed

---

### Story 1.5: Shop Owner revokes a staff member's access

**As a Shop Owner (Rajesh-ji)**,
I want to remove a staff member from my shop — for example, if a staff member leaves — and have their session immediately invalidated so they cannot access shop data,
So that I maintain tight control over who can see and act on my business data.

**FRs implemented:** FR14 (Shop Owner revokes shop user access)
**NFRs verified:** NFR-S5 (revoked refresh token invalidated), NFR-S9 (revocation audit-logged)
**Depends on:** Story 1.2 (shop_users table), Story 1.3 (session + JWT model)

**Modules + packages touched:**
- `apps/api/src/modules/auth/auth.service.ts` (extend — `DELETE /api/v1/auth/staff/:userId` endpoint)
- `packages/db/src/schema/shop-users.ts` (extend — soft-delete via `status = "REVOKED"`, `revoked_at`, `revoked_by_user_id`)
- `apps/api/src/modules/auth/auth.repository.ts` (extend — revoke method: update status + purge Redis refresh tokens for user)
- `packages/security/jwt.ts` (extend — `revokeAllSessionsForUser(userId)` purges all `refresh:{jti}` keys in Redis)
- `apps/shopkeeper/app/settings/staff.tsx` (extend — "हटाएं" (Remove) action per staff row with confirmation bottom sheet)
- `packages/i18n/locales/hi-IN/settings.json` (extend — revocation copy)

**ADRs governing:** ADR-0001, ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3 (auditLog on revocation), MUST #5, MUST #7
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the Shop Owner is on the Staff Management screen and taps "हटाएं" on Amit's row
**When** the confirmation bottom sheet appears
**Then** it shows "क्या आप Amit को हटाना चाहते हैं? यह action वापस नहीं ली जा सकती।" with a terracotta "हाँ, हटाएं" button and a ghost "रद्द करें" button
**And** the confirmation sheet is non-dismissable via backdrop tap (compliance-level action)

**Given** the Owner confirms removal
**When** the revocation request fires
**Then** the client calls `DELETE /api/v1/auth/staff/:userId` with TenantContext
**And** the server updates `shop_users.status = "REVOKED"` with `revoked_at = NOW()` and `revoked_by_user_id = owner_id`
**And** all Redis keys matching `refresh:*` for Amit's `user_id` are deleted (Redis SCAN + DEL pattern)
**And** `audit_events` records `STAFF_REVOKED` with `{ subject_id: amit_user_id, before: { status: "ACTIVE" }, after: { status: "REVOKED" } }`
**And** the Staff list immediately removes Amit's row (optimistic update)
**And** toast "Amit को हटा दिया गया" fires with medium haptic

**Given** Amit's session has been revoked and he tries to call any API endpoint with his existing access token (still within 15-minute TTL)
**When** the JWT is presented within its validity window
**Then** the server checks `shop_users.status` for the JWT's `sub` and finds `REVOKED`
**And** returns HTTP 401 with `{ errorCode: "auth.session_revoked" }`
**And** Amit's app shows "आपकी access हटा दी गई है। कृपया shop owner से संपर्क करें।" and navigates to the phone entry screen

**Given** Amit tries to use his refresh token after revocation
**When** the client calls `POST /api/v1/auth/refresh` with the revoked refresh token
**Then** the server finds no Redis key for that `jti` and returns HTTP 401 with `{ errorCode: "auth.refresh_token_invalid" }`

---

**Tests required:**
- Unit: `AuthService.revokeStaff()` — updates DB status, purges Redis tokens, emits audit; active-token API call returns 401 post-revocation (via status check)
- Integration: revoke → Amit's access token call → 401; refresh token call → 401; re-invite same phone → new INVITED row
- Tenant-isolation: tenant A revoking a staff member does not affect any of tenant B's staff sessions
- E2E (Detox): Owner removes staff → staff's app session shows revocation screen on next action

**Definition of Done:**
- All AC pass; CI gates green; all 5 review layers passed

---

### Story 1.6: Every authentication and permission event is captured in the immutable audit trail

**As a Shop Owner (Rajesh-ji) and as the Platform Team**,
I want every auth event (login, logout, invite, revoke, permission-change, failed-attempt) to be immutably recorded so that in case of a dispute or compliance review I have a complete, tamper-proof log,
So that I never face a "he said / she said" situation and the platform satisfies PMLA 5-year retention requirements.

**FRs implemented:** FR15 (all auth events logged to immutable 5-year audit trail)
**NFRs verified:** NFR-S9 (5-year immutable audit), NFR-C5 (PMLA 5-year retention — audit_events is the immutable substrate)
**Depends on:** Stories 1.1–1.5 (all events already being logged; this story adds the READ path and immutability hardening)

**Modules + packages touched:**
- `apps/api/src/modules/auth/auth.controller.ts` (extend — `GET /api/v1/auth/audit-log` — owner/manager only, paginated, filterable by date/action)
- `packages/db/src/schema/audit-events.ts` (extend — add DB-level trigger to prevent UPDATE/DELETE on `audit_events` via RLS + trigger)
- `packages/db/src/migrations/0004_audit_immutability.sql` (new — `REVOKE UPDATE, DELETE ON audit_events FROM app_user;` + trigger)
- `packages/db/src/schema/` (extend — add monthly partitioning setup for `audit_events` by `created_at`)
- `apps/shopkeeper/app/settings/audit-log.tsx` (new — audit log read screen; owner + manager only)
- `packages/ui-mobile/business/` (extend — simple `AuditEventRow` Tier 3 component)
- `packages/i18n/locales/hi-IN/settings.json` (extend — audit log Hindi copy)

**ADRs governing:** ADR-0002 (RLS write-denial), ADR-0005, ADR-0009
**Pattern rules honoured:** MUST #1 (audit_events has shop_id + RLS with INSERT-only for app_user), MUST #3 (auditLog() is the ONLY insertion point), MUST #5 (TenantContext)
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the `audit_events` table exists (from Story 1.1)
**When** an application-layer `UPDATE audit_events SET ...` statement is attempted
**Then** PostgreSQL raises `ERROR: permission denied for table audit_events` because the `app_user` Postgres role has only INSERT privilege (enforced via migration `REVOKE UPDATE, DELETE ON audit_events FROM app_user`)
**And** the Semgrep rule `goldsmith/audit-immutability` catches any ORM/Drizzle call attempting `.update()` on `audit_events` at CI time

**Given** the Shop Owner navigates to Settings → Audit Log
**When** the screen loads
**Then** a paginated list of audit events renders newest-first showing: date-time (IST Hindi locale), action type in Hindi (e.g., "लॉगिन सफल", "Staff जोड़ा", "अनुमति बदली"), performed-by name/phone
**And** the list is OWNER and MANAGER only — STAFF role sees a 403 "आपको यह देखने की permission नहीं है" screen
**And** filter chips allow narrowing by date range (today / 7 days / 30 days) and action category (Login, Staff, Permissions)

**Given** the audit log contains events from multiple staff members
**When** the owner views the log
**Then** events from ALL staff (including the owner themselves) are visible in one timeline
**And** each event shows the `ip_address` and a truncated `user_agent` for security context
**And** system-generated events (OTP rate-limit hit) appear in the log with `system` as the actor

**Given** a platform-admin runs an S3 export (simulated via test)
**When** the daily export job runs
**Then** all `audit_events` rows created in the prior 24 hours are exported to S3 under `audit-exports/{shop_id}/{yyyy-mm-dd}.jsonl` with server-side encryption
**And** the S3 object has `x-amz-object-lock-mode: COMPLIANCE` and retention of 5 years (via Object Lock)

---

**Tests required:**
- Unit: `auditLog()` — inserts exactly one row; cannot UPDATE existing row (DB-level and ORM-level); pagination query returns correct page
- Integration: submit auth events (login, invite, revoke, permission-change) → query audit log endpoint → all events appear with correct fields; STAFF role gets 403
- Security: attempt Drizzle `.update()` on `audit_events` → Postgres error; attempt direct SQL UPDATE via `app_user` role → permission denied
- E2E (Detox): Owner taps Audit Log → events listed newest-first; filter by "आज" (today) narrows to today's events

**Definition of Done:**
- All AC pass; CI gates green; `AuditEventRow` component has Storybook story; all 5 review layers passed

---

### Story 1.7: Shop Owner signs out from all devices simultaneously

**As a Shop Owner (Rajesh-ji)**,
I want to log out from ALL devices at once — for example, if I suspect my phone was accessed by someone else — and have every active session immediately invalidated,
So that I can be certain no one else can access my shop data.

**FRs implemented:** FR11 (logout invalidates sessions across devices)
**NFRs verified:** NFR-S5 (30-day refresh token rotation + revocation), NFR-S9 (logout audit-logged)
**Depends on:** Story 1.1 (session model + Redis refresh token storage)

**Modules + packages touched:**
- `apps/api/src/modules/auth/auth.service.ts` (extend — `POST /api/v1/auth/logout/all` endpoint)
- `packages/security/jwt.ts` (extend — `revokeAllSessionsForUser(userId)` — Redis SCAN `refresh:*:{userId}:*` pattern + DEL)
- `apps/shopkeeper/app/settings/account.tsx` (new — "Account" settings screen with "सभी devices से logout करें" button)
- `packages/i18n/locales/hi-IN/settings.json` (extend — logout copy)

**ADRs governing:** ADR-0001 (refresh token revocation list in Redis), ADR-0005
**Pattern rules honoured:** MUST #3 (auditLog on logout-all), MUST #5 (TenantContext), MUST #7 (Hindi)
**Complexity:** XS

---

**Acceptance Criteria:**

**Given** Rajesh-ji is logged in on two devices (his phone and the shop's tablet)
**When** he navigates to Settings → Account and taps "सभी devices से logout करें"
**Then** a confirmation bottom sheet appears: "सभी devices से logout हो जाएंगे। क्या आप sure हैं?" with a terracotta "हाँ, logout करें" button
**And** on confirmation the client calls `POST /api/v1/auth/logout/all` with the current access token

**When** the API processes the request
**Then** the server performs a Redis SCAN for all keys matching `refresh:*` associated with Rajesh-ji's `user_id` and DELetes them
**And** `audit_events` records `AUTH_LOGOUT_ALL` with `{ device_count_revoked: N, ip_address, user_agent }`
**And** the current device navigates to the phone-number entry screen (session cleared from memory)

**Given** the tablet (second device) makes any API call after logout-all
**When** the tablet presents its now-invalid access token (within 15-min TTL) or attempts refresh
**Then** the server checks `shop_users.status` — still ACTIVE — but the refresh token lookup fails (key deleted from Redis)
**And** the tablet returns HTTP 401 on refresh; the Expo app navigates to the phone-number entry screen automatically

**Given** Rajesh-ji logs back in on his primary phone after logout-all
**When** OTP verification completes
**Then** a new refresh token is issued (new `jti`, new Redis key); prior sessions remain invalidated

---

**Tests required:**
- Unit: `revokeAllSessionsForUser()` — Redis SCAN + DEL on all matching keys; audit event; empty-key-set edge case (no other devices)
- Integration: login on device A + device B → logout-all from A → device B's refresh call returns 401 → re-login on A issues new tokens
- E2E (Detox): logout-all → app navigates to phone-number screen; prior refresh token call returns 401

**Definition of Done:**
- All AC pass; CI gates green; all 5 review layers passed

---

## Epic 2: Shopkeeper runs their own shop by editing making charges, loyalty, policies, and preferences in Hindi

**Goal:** The jeweller owner opens settings at 10pm, changes his making charge for diamond rings from 12% to 10%, toggles try-at-home on, sets rate-lock to 7 days, writes his return policy in Hindi, and watches the settings saved immediately with a haptic + toast — all without calling the platform team. Settings that affect customer-facing surfaces propagate within 30 seconds (verified via a test stub; full customer-app read in Epic 7).

**FRs covered:** FR16 (shop profile), FR17 (making charges), FR18 (wastage %), FR19 (loyalty tiers), FR20 (rate-lock duration), FR21 (try-at-home toggle + piece count), FR22 (custom order policy text), FR23 (return/exchange policy text), FR24 (notification preferences)
**NFRs directly enforced:** NFR-P6 (30-sec propagation verified via test stub), NFR-S9 (settings-change audit)
**Phase:** Phase 0 — Sprint 2-3
**Dependencies:** Epic 1 (auth + tenant context + audit + SettingsGroupCard from Story 1.4)

---

### Story 2.1: Shopkeeper edits their shop profile

**As a Shop Owner (Rajesh-ji)**,
I want to open Settings → Shop Profile and update my shop's name, address, GSTIN, BIS registration number, phone, operating hours, and about text in Hindi — and have my customer-facing storefront reflect the updated shop name and hours within 30 seconds,
So that my customers always see accurate, current information about my shop.

**FRs implemented:** FR16 (shop profile editing)
**NFRs verified:** NFR-P6 (30-sec propagation SLA — verified via test polling endpoint), NFR-S9 (profile-change audit)
**Depends on:** Story 1.1 (auth + tenant context + audit), Story 1.4 (SettingsGroupCard component introduced)

**Modules + packages touched:**
- `apps/api/src/modules/settings/` (new bounded-context module — `settings.module.ts`, `settings.service.ts`, `settings.controller.ts`, `settings.repository.ts`, `settings.dto.ts`, `settings.types.ts`, `settings.events.ts`)
- `apps/api/src/modules/settings/settings.controller.ts` — `GET /api/v1/settings/profile`, `PATCH /api/v1/settings/profile`
- `packages/db/src/schema/shop-settings.ts` (new — `{ shop_id PK, profile_json JSONB, making_charges_json JSONB, wastage_json JSONB, loyalty_json JSONB, rate_lock_days INT, try_at_home_enabled BOOL, try_at_home_max_pieces INT, custom_order_policy_text TEXT, return_policy_text TEXT, notification_prefs_json JSONB, updated_at TIMESTAMPTZ }`)
- `packages/db/src/migrations/0005_shop_settings.sql` (new — creates `shop_settings` table with RLS policy)
- `packages/db/src/schema/shops.ts` (extend — add `name`, `address_json`, `gstin`, `bis_registration`, `phone`, `operating_hours_json`, `about_text`, `logo_url`, `years_in_business` columns if not already in shops table; OR these live in `shop_settings.profile_json` — architect decision: profile fields in `shops` table for easy global queries; mutable settings in `shop_settings`)
- `packages/tenant-config/src/settings/index.ts` (new — `getShopSettings(shopId)` with Redis cache 60s TTL; `invalidateSettingsCache(shopId)`)
- `packages/shared/schemas/shop-settings.schema.ts` (new — Zod schema for full settings DTO)
- `packages/i18n/locales/hi-IN/settings.json` (extend — profile screen Hindi copy)
- `apps/shopkeeper/app/settings/shop-profile.tsx` (new — shop profile edit screen)
- `apps/shopkeeper/src/features/settings/components/ShopProfileForm.tsx` (new — uses SettingsGroupCard + FormField)
- `packages/ui-mobile/business/SettingsGroupCard.tsx` (extend if needed; core component from Story 1.4)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0007 (polling for 30-sec propagation), ADR-0009
**Pattern rules honoured:** MUST #1 (shop_settings has shop_id FK + RLS), MUST #3 (auditLog on settings change), MUST #5 (TenantContext), MUST #6 (no hex colors), MUST #7 (Hindi-first), MUST #8 (tenant-isolation test extended with settings endpoint)
**Complexity:** M

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Shop Profile
**When** the screen loads
**Then** a SettingsGroupCard renders with current values pre-filled: shop name, address (street, city, state, PIN), GSTIN, BIS registration number, phone, operating hours (Mon-Sun toggles + open/close time), about text (Hindi text area, 500 char limit), logo upload placeholder
**And** all labels are in Hindi: "दुकान का नाम", "पता", "GSTIN", "BIS Registration", "फ़ोन", "काम के घंटे", "हमारे बारे में"
**And** the form uses save-on-change semantics (per UX-DR21 settings pattern) — no "Submit" button; each field saves when focus leaves

**Given** the Shop Owner changes the shop name from "Rajesh Jewellers" to "Rajesh Jewellers & Sons"
**When** focus leaves the shop name field
**Then** the client calls `PATCH /api/v1/settings/profile` with `{ name: "Rajesh Jewellers & Sons" }` and TenantContext
**And** the `shops` table row updates the `name` column
**And** the Redis settings cache key `shop:{shop_id}:settings` is invalidated
**And** `audit_events` records `SETTINGS_PROFILE_UPDATED` with `{ before: { name: "Rajesh Jewellers" }, after: { name: "Rajesh Jewellers & Sons" } }`
**And** a toast "बदलाव सहेज लिया ✓" fires with a check-mark icon and medium haptic within 200ms of save

**Given** the shop name has been updated
**When** a test polling endpoint `GET /api/v1/settings/profile` is called 30 seconds later (simulating customer-app read)
**Then** the response contains the updated `name: "Rajesh Jewellers & Sons"` (propagation SLA verified; this endpoint is the stub; actual customer-facing surface ships in Epic 7)
**And** the response includes an `ETag` header for client-side polling optimization (per ADR-0007)

**Given** the Shop Owner uploads a new logo image
**When** the upload initiates
**Then** the client requests a pre-signed S3 upload URL via `POST /api/v1/settings/profile/logo-upload-url`
**And** the client uploads directly to S3 under the tenant prefix `tenants/{shop_id}/logo/{uuid}.webp`
**And** after upload confirmation, the `shops.logo_url` is updated to the ImageKit-served CDN URL
**And** EXIF metadata is stripped on the server side before storing the reference

**Given** the owner enters an invalid GSTIN format (wrong length or checksum)
**When** focus leaves the GSTIN field
**Then** the save is blocked and an inline error renders below the field: "GSTIN format सही नहीं है। उदाहरण: 09AAACR5055K1Z5"
**And** the field has a 2px crimson-600 focus ring (error state per UX-DR19 pattern)
**And** the screen-reader announces the error in Hindi when focus enters the field

**Given** CI runs on this PR
**When** the tenant-isolation suite runs
**Then** a test asserts: `PATCH /api/v1/settings/profile` with tenant A's JWT cannot update tenant B's `shops` row
**And** direct DB read without `SET LOCAL` on `shop_settings` returns zero rows

---

**Tests required:**
- Unit: `SettingsService.updateProfile()` — Zod validation, GSTIN regex, upsert to DB, cache invalidation, auditLog call; logo URL update after S3 confirmation
- Integration: update shop name → DB updated → Redis cache invalidated → re-fetch returns new name within 30s; GSTIN validation rejects malformed input
- Tenant-isolation: tenant A profile update does not affect tenant B shop row
- E2E (Detox): Owner edits shop name → save-on-blur → toast fires → re-open screen shows updated name; accessibility: TalkBack reads field labels in Hindi; error state announced

**Definition of Done:**
- All AC pass; CI gates green; `ShopProfileForm` Storybook story (Hindi + English + error states + 2-tenant-theme); all 5 review layers passed

---

### Story 2.2: Shopkeeper configures default making charges per product category

**As a Shop Owner (Rajesh-ji)**,
I want to open Settings → Pricing & Policies → Making Charges and set my default making charge for each category (Rings, Chains, Bangles, Bridal, Silver, Wholesale) as either a percentage of gold value or a fixed rate per gram — and have billing auto-use these defaults when creating invoices,
So that I never have to manually calculate making charges for every invoice.

**FRs implemented:** FR17 (per-category default making charges — % or fixed per gram)
**NFRs verified:** NFR-P6 (updated making charges propagate to billing module within 30s via settings cache), NFR-S9 (settings-change audit)
**Depends on:** Story 2.1 (shop_settings table + settings module + SettingsGroupCard + tenant-config cache)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/making-charges`)
- `packages/db/src/schema/shop-settings.ts` (extend — `making_charges_json` column populated; Zod schema defines `MakingChargeConfig`: `{ category: CategoryEnum, type: 'percent' | 'fixed_per_gram', value: DECIMAL }`)
- `packages/shared/schemas/shop-settings.schema.ts` (extend — `MakingChargeConfig` Zod schema with precision rules)
- `packages/money/src/` (extend — ensure `MakingChargeValue` uses DECIMAL-backed Weight arithmetic for fixed-per-gram; not float)
- `packages/i18n/locales/hi-IN/settings.json` (extend — making charges Hindi copy: "बनाई का खर्च")
- `apps/shopkeeper/app/settings/making-charges.tsx` (new — making charges config screen)
- `apps/shopkeeper/src/features/settings/components/MakingChargeRow.tsx` (new — row per category with type toggle + value input)

**ADRs governing:** ADR-0002, ADR-0003 (DECIMAL for making charge values), ADR-0005, ADR-0009
**Pattern rules honoured:** MUST #1, MUST #2 (DECIMAL for making charge value — never FLOAT), MUST #3, MUST #5, MUST #7
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Making Charges
**When** the screen loads
**Then** a list of 6 category rows renders: "Gold Rings" (सोने की अंगूठियां), "Gold Chains" (सोने की चेन), "Gold Bangles" (सोने के कड़े), "Bridal" (दुल्हन के गहने), "Silver" (चांदी), "Wholesale" (थोक)
**And** each row shows: category name (Hindi primary, English secondary), current making-charge type toggle (% or ₹/gram), and current value
**And** defaults for a fresh shop are: Rings 12%, Chains 10%, Bangles 8%, Bridal 15%, Silver 5%, Wholesale 7%

**Given** the Shop Owner changes "Bridal" making charge from 15% to 10%
**When** focus leaves the value field
**Then** the client calls `PATCH /api/v1/settings/making-charges` with `{ category: "BRIDAL", type: "percent", value: "10.00" }` (value as string to preserve DECIMAL precision)
**And** `shop_settings.making_charges_json` JSONB is updated: `{ ..., "BRIDAL": { "type": "percent", "value": "10.00" } }`
**And** the value is stored and returned as `"10.00"` (string — never 10.0 float per ADR-0003)
**And** `audit_events` records `SETTINGS_MAKING_CHARGES_UPDATED` with before/after JSON
**And** toast "बदलाव सहेज लिया ✓" fires with medium haptic

**Given** the Shop Owner changes "Silver" from percent type to "₹/gram" fixed type and enters 1.50
**When** the setting is saved
**Then** `shop_settings.making_charges_json` stores `{ "SILVER": { "type": "fixed_per_gram", "value": "1.50" } }`
**And** the UI correctly displays "₹ 1.50/gram" next to the Silver row after save

**Given** the making charge for BRIDAL has been updated to 10%
**When** the billing module reads `useSetting(shopId, 'making_charges')` from `packages/tenant-config`
**Then** the cache returns the updated config within 60 seconds (Redis TTL)
**And** a new invoice draft for a Bridal item auto-applies 10% making charge (verified by a billing-module unit test stub — full billing ships in Epic 5)

**Given** the owner enters a making charge value of 0 or negative
**When** focus leaves the field
**Then** inline validation shows "बनाई का खर्च 0 से ज़्यादा होना चाहिए" and the save is blocked

---

**Tests required:**
- Unit: `SettingsService.updateMakingCharges()` — validates Zod schema (no float, no negative, no >100% for percent type); JSONB upsert; cache invalidation; auditLog; `MakingChargeValue` DECIMAL arithmetic
- Integration: update making charge → `shop_settings` updated → billing-module stub reads updated value within 60s from cache
- Tenant-isolation: making charge update for tenant A does not affect tenant B's config
- Weight-precision assertion: making charge percent applied to a DECIMAL weight never loses precision (10K-harness extended with making-charge calculation)
- E2E (Detox): Owner changes Bridal from 15% to 10% → toast fires → re-open screen confirms 10%; type toggle switches from % to ₹/gram correctly

**Definition of Done:**
- All AC pass; CI gates green; `MakingChargeRow` Storybook story (Hindi + English); weight-precision harness extended; all 5 review layers passed

---

### Story 2.3: Shopkeeper configures default wastage percentages per product category

**As a Shop Owner (Rajesh-ji)**,
I want to set the default wastage percentage for each product category so that when I create an invoice, the system automatically adds the wastage weight/charge to the billing calculation,
So that I'm always compensated for metal lost during fabrication without manually calculating it per piece.

**FRs implemented:** FR18 (per-category default wastage %)
**NFRs verified:** NFR-P6 (wastage config propagates to billing cache within 30s), NFR-S9 (settings-change audit)
**Depends on:** Story 2.2 (settings module + making_charges pattern established; share same settings module + SettingsGroupCard pattern)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/wastage`)
- `packages/db/src/schema/shop-settings.ts` (extend — `wastage_json JSONB` column; `WastageConfig: { category: CategoryEnum, percent: DECIMAL(5,2) }`)
- `packages/shared/schemas/shop-settings.schema.ts` (extend — `WastageConfig` Zod schema with DECIMAL precision assertion)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "घटत का प्रतिशत")
- `apps/shopkeeper/app/settings/wastage.tsx` (new — wastage config screen, shares MakingChargeRow pattern)
- `apps/shopkeeper/src/features/settings/components/WastageRow.tsx` (new — simpler than MakingChargeRow; percent-only type)

**ADRs governing:** ADR-0002, ADR-0003 (DECIMAL), ADR-0005
**Pattern rules honoured:** MUST #1, MUST #2 (DECIMAL for wastage percent), MUST #3, MUST #5, MUST #7
**Complexity:** XS (pattern established in Story 2.2; wastage is percent-only so simpler)

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Wastage %
**When** the screen loads
**Then** 6 category rows render (same categories as making charges): each showing current wastage percentage; defaults: Rings 2.0%, Chains 1.5%, Bangles 1.5%, Bridal 3.0%, Silver 1.0%, Wholesale 1.0%
**And** all labels are in Hindi; category names match making-charges screen for UX consistency

**Given** the Shop Owner changes Bridal wastage from 3.0% to 2.5%
**When** focus leaves the field
**Then** the client calls `PATCH /api/v1/settings/wastage` with `{ category: "BRIDAL", percent: "2.50" }` (string DECIMAL)
**And** `shop_settings.wastage_json` is updated with `{ "BRIDAL": "2.50" }`
**And** `audit_events` records `SETTINGS_WASTAGE_UPDATED` with before/after
**And** toast fires with haptic

**Given** the owner enters a wastage of 50% for any category
**When** the field is saved
**Then** inline validation shows "घटत 30% से ज़्यादा नहीं होनी चाहिए — कृपया सही मात्रा डालें" (business rule: wastage > 30% is flagged as suspicious)

---

**Tests required:**
- Unit: `SettingsService.updateWastage()` — DECIMAL storage, business-rule validation (>30% warning), auditLog, cache invalidation
- Integration: update wastage → billing stub reads updated wastage within cache TTL; DECIMAL precision preserved in JSONB
- Weight-precision harness: wastage percent applied to DECIMAL gross weight produces DECIMAL net weight with correct 4dp precision
- E2E (Detox): Owner changes Bridal wastage to 2.5% → toast fires → re-open confirms 2.5%

**Definition of Done:**
- All AC pass; CI gates green; `WastageRow` Storybook story; weight-precision harness extended; all 5 review layers passed

---

### Story 2.4: Shopkeeper configures loyalty program tiers and accrual/redemption rates

**As a Shop Owner (Rajesh-ji)**,
I want to define my loyalty program — give tiers memorable Hindi names (Silver/Gold/Diamond), set the spending thresholds that trigger each tier, set how many points a customer earns per rupee spent, and set the redemption rate — so that the loyalty program reflects my shop's unique relationship with customers,
So that I can run a loyalty program that feels personal and encourages repeat visits.

**FRs implemented:** FR19 (loyalty program parameters — tier names, thresholds, earn rate, redemption rate)
**NFRs verified:** NFR-P6 (loyalty config propagated to loyalty module within 30s), NFR-S9 (loyalty config audit)
**Depends on:** Story 2.1 (shop_settings table + settings module)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/loyalty`)
- `packages/db/src/schema/shop-settings.ts` (extend — `loyalty_json JSONB`: `LoyaltyConfig: { tiers: Array<{ name, thresholdPaise: BIGINT, badgeColor }>, earnRatePercentage: DECIMAL, redemptionRatePercentage: DECIMAL }`)
- `packages/shared/schemas/shop-settings.schema.ts` (extend — `LoyaltyConfig` Zod schema)
- `packages/money/src/` (extend — `LoyaltyPointValue` uses paise for thresholds)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "Loyalty Program" copy: "वफ़ादारी कार्यक्रम")
- `apps/shopkeeper/app/settings/loyalty.tsx` (new — loyalty config screen)
- `apps/shopkeeper/src/features/settings/components/LoyaltyTierForm.tsx` (new — 3 tier rows with name input + threshold input + badge color preview)

**ADRs governing:** ADR-0002, ADR-0003 (BIGINT paise for thresholds), ADR-0005
**Pattern rules honoured:** MUST #1, MUST #2 (thresholds in paise BIGINT, earn/redemption in DECIMAL%), MUST #3, MUST #5, MUST #7
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Loyalty Program
**When** the screen loads
**Then** 3 tier rows render (Tier 1 default "Silver", Tier 2 "Gold", Tier 3 "Diamond") with: Hindi name input (editable), annual spend threshold (in ₹, displayed as Indian-formatted number), badge color preview circle
**And** earn rate row shows: "हर ₹100 खर्च पर X points" with default 1 point per ₹100
**And** redemption rate row shows: "100 points = ₹Y छूट" with default ₹1 per 100 points

**Given** the owner renames Tier 1 from "Silver" to "Chandi" and sets its threshold to ₹50,000/year
**When** the field is saved
**Then** `shop_settings.loyalty_json` stores `{ tiers: [{ name: "Chandi", thresholdPaise: 5000000, ... }, ...], ... }` (₹50,000 = 5,000,000 paise — stored as BIGINT)
**And** `audit_events` records `SETTINGS_LOYALTY_UPDATED` with before/after JSON
**And** toast fires

**Given** the owner sets earn rate to 2 points per ₹100 and redemption rate to ₹2 per 100 points
**When** saved
**Then** `loyalty_json.earnRatePercentage: "2.00"` and `loyalty_json.redemptionRatePercentage: "2.00"` are stored as DECIMAL strings
**And** the loyalty module's `useSetting(shopId, 'loyalty')` returns the updated config within 60s

**Given** the owner sets a tier threshold below ₹0 or above ₹10,00,00,000 (1 crore)
**When** the field is saved
**Then** inline validation: "सीमा ₹0 और ₹1,00,00,000 के बीच होनी चाहिए"

**Given** tier thresholds are set where Tier 2 threshold is lower than Tier 1
**When** the owner navigates away from the screen
**Then** a validation warning displays: "Tier thresholds बढ़ते क्रम में होने चाहिए" before navigating

---

**Tests required:**
- Unit: `SettingsService.updateLoyalty()` — paise conversion (₹ input → BIGINT paise), tier ordering validation, earn/redemption DECIMAL storage, auditLog
- Integration: update tiers → loyalty module stub reads updated config within cache TTL; paise values correct
- E2E (Detox): Owner renames tier + sets threshold → toast fires → re-open confirms change

**Definition of Done:**
- All AC pass; CI gates green; `LoyaltyTierForm` Storybook story (Hindi + English + 3-tier variants); all 5 review layers passed

---

### Story 2.5: Shopkeeper configures rate-lock duration

**As a Shop Owner (Rajesh-ji)**,
I want to set how many days a customer can lock today's gold rate — for example, "7 days" means if a customer pays a deposit today, they have 7 days to come in and buy at today's price — so that I can set a policy that balances customer trust with my gold-rate exposure risk,
So that my rate-lock policy is consistent and automatic without my staff having to remember the rules.

**FRs implemented:** FR20 (rate-lock duration 1-30 day range)
**NFRs verified:** NFR-P6 (rate-lock duration propagates to rate-lock module within 30s), NFR-S9 (settings-change audit)
**Depends on:** Story 2.1 (shop_settings table + settings module)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/rate-lock`)
- `packages/db/src/schema/shop-settings.ts` (extend — `rate_lock_days SMALLINT CHECK (rate_lock_days BETWEEN 1 AND 30) DEFAULT 7`)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "Rate Lock की अवधि")
- `apps/shopkeeper/app/settings/rate-lock.tsx` (new — simple slider/picker screen)
- `apps/shopkeeper/src/features/settings/components/RateLockDurationPicker.tsx` (new — Tier 3; uses SettingsGroupCard with a numeric stepper 1-30)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** XS

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Rate Lock Duration
**When** the screen loads
**Then** a SettingsGroupCard renders with: label "Rate Lock की अवधि (दिनों में)", a numeric stepper showing current value (default 7), and an explanatory text "इतने दिनों तक customer आज की gold rate पर खरीद सकते हैं"
**And** the stepper is bounded: minimum 1, maximum 30; each tap changes by 1

**Given** the owner changes rate-lock duration from 7 days to 10 days
**When** the stepper value changes (auto-save after 1 second debounce)
**Then** the client calls `PATCH /api/v1/settings/rate-lock` with `{ rateLockDays: 10 }`
**And** `shop_settings.rate_lock_days = 10` is updated in DB
**And** `audit_events` records `SETTINGS_RATE_LOCK_UPDATED` with before/after
**And** toast fires

**Given** the rate-lock duration has been updated to 10 days
**When** the rate-lock module reads `useSetting(shopId, 'rate_lock_days')`
**Then** it returns 10 within 60 seconds (cache TTL)
**And** new rate-lock bookings use 10-day expiry (verified by rate-lock module unit test stub — full rate-lock in Epic 9)

**Given** the owner tries to manually type 31 in the stepper field
**Then** the input is clamped to 30 and a subtle shake animation plays (no toast — low-stakes validation per UX-DR20)

---

**Tests required:**
- Unit: `SettingsService.updateRateLock()` — validates 1-30 range, DB column update, cache invalidation, auditLog
- Integration: update rate-lock days → rate-lock module stub reads updated value within 60s
- E2E (Detox): Owner taps stepper → value changes → auto-save fires → re-open confirms new value

**Definition of Done:**
- All AC pass; CI gates green; `RateLockDurationPicker` Storybook story; all 5 review layers passed

---

### Story 2.6: Shopkeeper toggles try-at-home and sets the piece-count limit

**As a Shop Owner (Rajesh-ji)**,
I want to enable or disable the try-at-home service for my shop and set the maximum number of pieces a customer can request per visit — so that I control whether this service is active and how much operational load it creates,
So that try-at-home is only available when I've decided to offer it and within my capacity constraints.

**FRs implemented:** FR21 (try-at-home enable toggle + piece-count limit per booking)
**NFRs verified:** NFR-P6 (try-at-home toggle propagates to customer app feature flag within 30s), NFR-S9 (audit)
**Depends on:** Story 2.1 (shop_settings table + settings module)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/try-at-home`)
- `packages/db/src/schema/shop-settings.ts` (extend — `try_at_home_enabled BOOL DEFAULT false`, `try_at_home_max_pieces SMALLINT CHECK (try_at_home_max_pieces BETWEEN 1 AND 10) DEFAULT 3`)
- `packages/tenant-config/src/feature-flags/` (extend — `useFeature('try_at_home', shopId)` reads `try_at_home_enabled` from `shop_settings`)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "घर पर try करें")
- `apps/shopkeeper/app/settings/try-at-home.tsx` (new)
- `apps/shopkeeper/src/features/settings/components/TryAtHomeToggle.tsx` (new — toggle + piece-count stepper; stepper disabled when toggle is OFF)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0008 (feature flag resolves theme and feature availability)
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** XS

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Try at Home
**When** the screen loads
**Then** a SettingsGroupCard renders with: "घर पर try करें" toggle (default OFF for anchor per MVP scope), explanatory text "Customer घर पर कुछ pieces try करके खरीद सकते हैं", and a greyed-out "अधिकतम pieces per booking" stepper (greyed because toggle is OFF)

**Given** the owner enables the try-at-home toggle
**When** the toggle is switched ON
**Then** the piece-count stepper becomes active (3 default)
**And** the client calls `PATCH /api/v1/settings/try-at-home` with `{ tryAtHomeEnabled: true, tryAtHomeMaxPieces: 3 }`
**And** `shop_settings.try_at_home_enabled = true` and `try_at_home_max_pieces = 3` are updated
**And** `packages/tenant-config`'s `useFeature('try_at_home', shopId)` now returns `true` within 60s
**And** `audit_events` records `SETTINGS_TRY_AT_HOME_ENABLED` with before/after
**And** toast "बदलाव सहेज लिया ✓" fires

**Given** the owner changes piece count from 3 to 5
**When** the stepper increments
**Then** `PATCH /api/v1/settings/try-at-home` is called with `{ tryAtHomeMaxPieces: 5 }` after 1s debounce
**And** `audit_events` records `SETTINGS_TRY_AT_HOME_PIECES_UPDATED`

**Given** the try-at-home toggle is ON
**When** a customer app stub calls `GET /api/v1/settings/feature-flags`
**Then** `{ try_at_home: true, max_pieces: 5 }` is returned (customer app will gate the "Book Try at Home" UI behind this flag; Epic 10 implements the full flow)

**Given** the owner disables try-at-home
**When** the toggle is switched OFF
**Then** `try_at_home_enabled = false` is saved; the piece-count stepper greys out; `useFeature('try_at_home', shopId)` returns `false` within 60s

---

**Tests required:**
- Unit: `SettingsService.updateTryAtHome()` — toggle + piece-count validation (1-10 range), auditLog, cache + feature-flag invalidation
- Integration: enable toggle → `useFeature` returns true within 60s; disable toggle → returns false; customer-stub endpoint reflects flag
- E2E (Detox): Owner toggles ON → piece-count stepper activates → changes pieces to 5 → toast fires

**Definition of Done:**
- All AC pass; CI gates green; `TryAtHomeToggle` Storybook story (ON/OFF/disabled states); all 5 review layers passed

---

### Story 2.7: Shopkeeper edits their custom order policy text

**As a Shop Owner (Rajesh-ji)**,
I want to write my own custom order policy in Hindi — covering my refund rules, how many rework rounds I allow, the deposit structure, and the cancellation window — so that customers understand my terms before placing a custom order,
So that I never have disputes about policy because customers read and agree to my own words.

**FRs implemented:** FR22 (custom order policy text: refund/rework/deposit/cancellation)
**NFRs verified:** NFR-P6 (policy text propagates to customer-facing surfaces within 30s), NFR-S9 (policy update audit)
**Depends on:** Story 2.1 (shop_settings table + settings module)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/custom-order-policy`)
- `packages/db/src/schema/shop-settings.ts` (extend — `custom_order_policy_text TEXT` column; max 2000 chars)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "Custom Order Policy")
- `apps/shopkeeper/app/settings/custom-order-policy.tsx` (new — text editor screen with Hindi keyboard support)
- `apps/shopkeeper/src/features/settings/components/PolicyTextEditor.tsx` (new — multiline text area using FormField Tier 1 + character counter + structured template helper)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** XS

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Custom Order Policy
**When** the screen loads
**Then** a multiline text area renders pre-filled with a structured Hindi template:
  ```
  1. जमा राशि: कुल राशि का 25% order confirm होने पर।
  2. बदलाव: design पर 2 बार बदलाव allowed है।
  3. cancel: 24 घंटे में cancel पर जमा राशि वापस।
  4. return: बने हुए गहने वापस नहीं लिए जाएंगे।
  ```
**And** a character counter "X / 2000" appears at the bottom-right
**And** a "Template से शुरू करें" link appears to reset to the default template

**Given** the owner edits the policy text and navigates away
**When** unsaved changes are pending
**Then** the screen prompts "आपके बदलाव save नहीं हुए। क्या आप जाना चाहते हैं?" with "रुकें" (stay) and "जाएं" (leave) options — because this is a text-area requiring explicit save (exception to save-on-change pattern; noted in UX-DR21 as "multi-line text = explicit save")

**Given** the owner finishes editing and taps "Save करें"
**When** the save fires
**Then** `PATCH /api/v1/settings/custom-order-policy` is called with `{ customOrderPolicyText: "..." }` (text validated: no script injection, max 2000 chars, not empty)
**And** `shop_settings.custom_order_policy_text` is updated
**And** `audit_events` records `SETTINGS_CUSTOM_ORDER_POLICY_UPDATED` with before text hash + after text hash (NOT full before text — privacy-aware; policy text length + hash logged; full after text in DB)
**And** toast "Policy सहेज ली" fires with haptic
**And** the customer-facing custom-order flow will surface this text (verified via Epic 11; stub in this story confirms `GET /api/v1/settings/custom-order-policy` returns the saved text)

**Given** the owner submits an empty policy text
**Then** inline error: "Policy text खाली नहीं छोड़ सकते"

---

**Tests required:**
- Unit: `SettingsService.updateCustomOrderPolicy()` — max length validation (2000 chars), XSS sanitization (strip `<script>` tags), auditLog with hash, DB update
- Integration: save policy → `GET /api/v1/settings/custom-order-policy` returns saved text; blank text returns validation error
- E2E (Detox): Owner edits policy → taps save → toast fires → navigates back → re-opens → shows saved text; Hindi keyboard input works correctly

**Definition of Done:**
- All AC pass; CI gates green; `PolicyTextEditor` Storybook story (empty + filled + error + character-limit states); all 5 review layers passed

---

### Story 2.8: Shopkeeper edits return and exchange policy text

**As a Shop Owner (Rajesh-ji)**,
I want to write my shop's return and exchange policy in Hindi — including which items are returnable, the window period, and the exchange terms — so that this text is displayed on every product page in my customer app,
So that customers know my terms before they inquire, reducing disputes after purchase.

**FRs implemented:** FR23 (return/exchange policy text displayed in customer app on every PDP + policy section)
**NFRs verified:** NFR-P6 (policy text propagates within 30s), NFR-S9 (audit)
**Depends on:** Story 2.7 (PolicyTextEditor component + pattern established)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/return-policy`)
- `packages/db/src/schema/shop-settings.ts` (extend — `return_policy_text TEXT` column; max 1500 chars)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "वापसी और exchange नीति")
- `apps/shopkeeper/app/settings/return-policy.tsx` (new — reuses PolicyTextEditor component with different template and character limit)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** XS (nearly identical to Story 2.7; reuses PolicyTextEditor)

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Pricing & Policies → Return Policy
**When** the screen loads
**Then** a PolicyTextEditor renders with a return-policy-specific Hindi template:
  ```
  1. वापसी: खरीद के 7 दिनों के अंदर, bill के साथ।
  2. exchange: बराबर या ज़्यादा कीमत की चीज़ से exchange।
  3. सोने की बनाई और पत्थर का खर्च वापस नहीं होगा।
  4. custom order और bridalwear पर कोई वापसी नहीं।
  ```
**And** character limit is 1500; counter visible

**Given** the owner edits the return policy and saves
**When** the save fires
**Then** `PATCH /api/v1/settings/return-policy` is called and `shop_settings.return_policy_text` is updated
**And** `audit_events` records `SETTINGS_RETURN_POLICY_UPDATED`
**And** toast fires

**Given** the return policy has been saved
**When** `GET /api/v1/settings/return-policy` is called (stub for customer-app PDP; full integration in Epic 7)
**Then** the saved return policy text is returned
**And** the response includes an `ETag` for polling optimization (per ADR-0007)

---

**Tests required:**
- Unit: `SettingsService.updateReturnPolicy()` — max length validation (1500 chars), XSS sanitization, auditLog, DB update
- Integration: save policy → GET returns saved text; policy appears in customer-app test stub within 30s
- E2E (Detox): Owner edits return policy → saves → Hindi text preserved correctly

**Definition of Done:**
- All AC pass; CI gates green; no new Storybook story needed (PolicyTextEditor already covered in Story 2.7 — extend with return-policy variant snapshot); all 5 review layers passed

---

### Story 2.9: Shopkeeper configures notification preferences per event and channel

**As a Shop Owner (Rajesh-ji)**,
I want to control exactly which events trigger a notification and on which channels (WhatsApp, SMS, Push, Email) — for example, "send me a push when a new inquiry comes in, but don't send WhatsApp to myself for every invoice I generate" — so that I control my notification load and my customers get the right touchpoints from my shop,
So that I never miss an important event and never spam myself or my customers.

**FRs implemented:** FR24 (notification preferences per event + channel: WhatsApp/SMS/push/email for shopkeeper-to-self AND customer-facing notification triggers)
**NFRs verified:** NFR-P6 (notification preferences propagate to notification dispatcher within 30s), NFR-S9 (preferences-change audit)
**Depends on:** Story 2.1 (shop_settings table + settings module)

**Modules + packages touched:**
- `apps/api/src/modules/settings/settings.controller.ts` (extend — `GET/PATCH /api/v1/settings/notifications`)
- `packages/db/src/schema/shop-settings.ts` (extend — `notification_prefs_json JSONB`: `NotificationPrefsConfig: { events: Record<EventKey, { shopkeeper: ChannelSet, customer: ChannelSet }> }` where `ChannelSet = { whatsapp: bool, sms: bool, push: bool, email: bool }`)
- `packages/shared/schemas/shop-settings.schema.ts` (extend — `NotificationPrefsConfig` Zod schema with all `EventKey` values enumerated)
- `packages/i18n/locales/hi-IN/settings.json` (extend — "Notifications" copy; event name Hindi labels)
- `apps/shopkeeper/app/settings/notifications.tsx` (new — notifications preferences screen)
- `apps/shopkeeper/src/features/settings/components/NotificationEventRow.tsx` (new — one row per event, two column groups: "मुझे" (shopkeeper) + "Customer को", 4 channel toggles each)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** S

---

**Acceptance Criteria:**

**Given** the Shop Owner navigates to Settings → Notifications
**When** the screen loads
**Then** a grouped list of notification events renders, organized in two sections: "मेरे लिए Notifications" and "Customer के लिए Notifications"

**Events in "मेरे लिए" group:**
- नई inquiry आई (new inquiry)
- नया try-at-home booking (new try-at-home)
- नई review आई (new review)
- PMLA warning (PMLA cumulative threshold)
- Custom order overdue (stage overdue)
- कम stock alert (low stock)

**Events in "Customer के लिए" group:**
- Invoice share (post billing)
- Progress photo sent (custom order)
- Rate lock confirm
- Rate lock expiry reminder
- Loyalty tier upgrade
- Festival campaign (marketing, explicit customer opt-in stated)

**And** each event row shows 4 channel toggles: WhatsApp, SMS, Push, Email with Hindi labels; some channels are greyed-out if not applicable (e.g., Email toggle for "नई inquiry" is off by default and greyed — email delivery not implemented in MVP)

**Given** the owner turns OFF "Invoice share → Customer → WhatsApp"
**When** the toggle is switched OFF
**Then** `PATCH /api/v1/settings/notifications` is called with `{ eventKey: "invoice.customer.whatsapp", enabled: false }`
**And** `shop_settings.notification_prefs_json` is updated for that event+channel combination
**And** `audit_events` records `SETTINGS_NOTIFICATIONS_UPDATED` with before/after for the specific toggle
**And** the notification dispatcher (Epic 13) reads `useSetting(shopId, 'notification_prefs')` and will skip WhatsApp dispatch for invoice events for this tenant

**Given** the owner tries to disable ALL channels for "Invoice share → Customer"
**When** the last channel is turned OFF
**Then** an inline warning (non-blocking) appears: "Customer को invoice share नहीं होगी — क्या आप sure हैं?" with a "हाँ, disable करें" / "रद्द करें" choice (note: this is a WARNING not a hard block — shopkeeper can disable notifications)

**Given** the "Festival campaign" customer notification is turned ON
**When** the toggle fires
**Then** an explanatory text appears below the toggle: "Customers जिन्होंने marketing notifications opt-in किया है उन्हें ही message जाएगा।" (links to DPDPA consent: only opted-in customers receive this; enforced in Epic 13)

**Given** the notification preferences have been updated
**When** the notification dispatcher (stub) reads `useSetting(shopId, 'notification_prefs')` after 60s
**Then** the returned config reflects the updated toggles

---

**Tests required:**
- Unit: `SettingsService.updateNotificationPrefs()` — JSONB partial update (only changed event+channel), auditLog with specific toggle fields, cache invalidation; notification dispatcher stub reads updated prefs
- Integration: toggle invoice-whatsapp OFF → dispatcher stub called with event → stub confirms WhatsApp channel is skipped based on settings
- Tenant-isolation: notification prefs of tenant A do not affect tenant B's dispatcher behavior
- E2E (Detox): Owner toggles invoice WhatsApp OFF → toast fires → re-open confirms toggle OFF; warning appears when last channel for an event is disabled

**Definition of Done:**
- All AC pass; CI gates green; `NotificationEventRow` Storybook story (enabled / disabled / warning state + Hindi + English); all 5 review layers passed

---

## Story Count Summary

| Epic | Story Count | Stories |
|------|-------------|---------|
| Epic 1 | 7 | 1.1 (XL), 1.2 (S), 1.3 (M), 1.4 (M), 1.5 (S), 1.6 (S), 1.7 (XS) |
| Epic 2 | 9 | 2.1 (M), 2.2 (S), 2.3 (XS), 2.4 (S), 2.5 (XS), 2.6 (XS), 2.7 (XS), 2.8 (XS), 2.9 (S) |
| **Total** | **16** | — |

## Decisions Deferred for Orchestrator Review

1. **Story 1.4 introduces `SettingsGroupCard` (Tier 3 component) ahead of Epic 2** — this is intentional per the architecture's "component builds up through tiers" principle and avoids re-doing Story 2.1's component work. Orchestrator should confirm no other parallel epic agent is also creating `SettingsGroupCard`.

2. **`shop_settings` table design decision:** Profile fields (`name`, `address_json`, `gstin`, `bis_registration`, `phone`, `operating_hours_json`, `about_text`, `logo_url`, `years_in_business`) are stored in the `shops` table (for easy global queries and tenant-provisioning flow), while all mutable config (making charges, wastage, loyalty, rate-lock, try-at-home, policy texts, notification prefs) lives in `shop_settings`. This is documented in Story 2.1's module notes. If the architect wants everything in `shop_settings.profile_json`, stories 2.1 and 1.1 both need updating.

3. **NFR-P6 verification stub:** All Epic 2 stories verify the 30-sec propagation SLA using a controlled `GET /api/v1/settings/*` test endpoint. The actual customer-facing propagation (customer app polling `shop_settings` via TanStack Query) is implemented in Epic 7 (catalog + customer app). Orchestrator should confirm this split is acceptable.

4. **Story 1.1 complexity (XL):** This bundles monorepo scaffold + enterprise floor + CI setup + auth + RLS + tenant-isolation harness + observability baseline per IR-report correction #7. If the sprint team decides to split scaffold + CI from auth, it should be done before dev execution — the story is correct as written but would need a "0.0" scaffold story. No split recommended because the epic definition-of-success requires both to ship together.
