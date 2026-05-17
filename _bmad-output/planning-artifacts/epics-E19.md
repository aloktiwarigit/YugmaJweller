---
generatedBy: 'Opus 4.7 — production-readiness audit conversion (principal-architect deep review)'
epic: 'E19 (Customer-Surface Production Readiness)'
date: '2026-05-16'
status: 'awaiting-triage; not yet sprinted'
parent_audit: 'C:/Users/alokt/.claude/plans/deep-review-customer-app-starry-pike.md'
parent_prd: '_bmad-output/planning-artifacts/prd.md (FR1–FR126 unchanged)'
addendum: 'docs/prd-addendum-customer-storefront.md (FR127–FR140 + completion notes)'
gap_source: 'C:/Users/alokt/.claude/plans/deep-review-customer-app-starry-pike.md §1–§7 (audit findings)'
phase: 'Phase 2 — Customer-Surface Hardening (post Phase E demo-readiness)'
gtm_context: 'Demo-first per CLAUDE.md 2026-05-05; E19 closes the "what additionally is needed before a paying tenant goes live with real customers" gap'
notes:
  - >
    Epic 19 = paying-tenant production hardening for `apps/customer-mobile` + `apps/customer-web`
    + their `apps/api` customer surface + CI/infra gates. The audit (parent_audit) graded
    customer-web at 70% / customer-mobile at 65% / cross-cutting at 75% production-ready
    against the CLAUDE.md enterprise floor. E19 closes the named gaps.
  - >
    Wave 1 (P0, six stories) = paying-tenant deploy unblockers. None share files; all five
    feature stories parallelise across worktrees. Wave 1 gate (19.6) re-runs the cross-model
    review on merged HEAD before any production deploy.
  - >
    Wave 2 (P1, nine stories) = production claim defensible. 19.7 (DPDPA Right to Erasure)
    is Class A and runs serially in a fresh session per `feedback_fresh_session_prompt_ceremony.md`.
    All other P1 work parallelises across worktrees per `feedback_parallel_session_worktrees.md`
    subject to the merge-contention rules in §Parallelisation Strategy below.
  - >
    Story IDs: 19.<n>. T-tag uses T19.<n> for traceability with the parent_audit's P0/P1 table.
  - >
    Ceremony per CLAUDE.md per-class protocol: Class A = full ceremony (5–7 work streams,
    parallel Codex + /security-review); Class B = compressed (3–5 work streams, Codex-only
    gate by default; /security-review when story adds a new attack surface);
    Class C = minimal (per-task tests where behaviour changed, whole-branch review at PR).
    No ceremony cut applies inside E19 because every story exists to *raise* the ceremony floor.
  - >
    Non-negotiable floor (all classes, unchanged): TS strict on customer-web (already on);
    flipping strict on customer-mobile is Story 19.12. WCAG 2.1 AA on web. ≥48dp touch on
    mobile. Hindi-first typography. No Goldsmith brand leakage on customer surfaces.
    No FLOAT for weights (this epic does not touch weight/money columns; the rule still
    holds for any migration this epic adds). Runtime smoke on intended surface before push.
  - >
    Codex availability: the Codex weekly limit may not be open when each story finishes.
    Per `feedback_codex_limit_batch_strategy.md`: Class B stories may merge with the
    /security-review + whole-branch review + CI substitute gate (noted in commit); Class A
    stories (19.6, 19.7) MUST hold for Codex green. The merge-train pattern applies.
  - >
    Code-truth audit (per `docs/code-truth-completion-audit-2026-05-04.md`) gates every
    story's "complete" claim. No memory or commit-message claim of completion accepted
    without `git grep` evidence on current code per the parent_audit's verification §7.
---

---

## Epic 19: Customer-Surface Production Readiness — close the demo-readiness vs paying-tenant gap

**Goal:** Bring `apps/customer-web` and `apps/customer-mobile` from "demo-ready" (today) to "production-ready for a paying tenant" (after this epic). Close the six P0 gaps that block any production deploy and the nine P1 gaps that block any defensible "production" claim, so the anchor jeweller can sign the SOW with confidence the customer-facing surface meets the enterprise floor end-to-end.

**FRs covered (closure of existing FRs, no new FRs):**
- FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50 (wishlist closure — backend on web, not just localStorage)
- FR96 (customer order/booking history surfaced on web, not just mobile)
- FR82, FR83, FR84 (browse filter UX completeness on web)
- Customer-side DPDPA Right to Erasure (regulatory FR carried forward from PRD §Compliance — operationalised end-to-end)

**NFRs verified:**
- NFR-S* (security): customer-side audit log coverage, fresh /security-review on deployment surface, DPDPA Right to Erasure
- NFR-OPS* (operations): Sentry on both customer apps, structured deploy + rollback, observability parity with API
- NFR-A4, NFR-A6, NFR-A7 (accessibility): unaffected — already on; this epic does not regress them
- NFR-C7 (data residency): Cloud Run deploy step + App Hosting config must target asia-south1 / India region

**Phase:** Phase 2 — Customer-Surface Hardening (post Phase E demo-readiness merge per memory `project_phase_e_demo_readiness_merged.md`)

**Dependencies:**
- Feature-complete main branch (HEAD `7aaf800` as of 2026-05-16)
- API customer surface already on main (catalog/customer/wishlist/reviews modules per audit §3)
- `@goldsmith/audit`, `@goldsmith/observability`, `@goldsmith/customer-shared` packages exist and are stable
- Firebase Auth project + Cloud Run service + Artifact Registry already provisioned (per recent commit `7aaf800`)
- `apphosting.yaml` skeleton exists at `apps/customer-web/apphosting.yaml` (currently a template; story 19.3 populates it)
- `eas.json` skeleton exists at `apps/customer-mobile/eas.json` (currently production profile empty; story 19.4 populates it)

---

### Story 19.1 (T19.1): customer-web errors are captured by Sentry with source maps

**Class:** B — observability wiring on a public surface; no compliance or RLS surface; routine integration.
**Wave:** 1 (P0) · **Worktree:** `C:/gs19-sentry-web` · **Depends on:** none · **Blocks:** 19.6 (review gate), 19.8 (wishlist→backend story wants Sentry to land first so write-path errors get caught), 19.9 (web profile timeline same reason)

**As an on-call engineer at Goldsmith**,
I want every uncaught SSR/RSC/client error in the customer-web storefront to land in Sentry with resolved source maps and tenant context,
So that I can triage production incidents in seconds instead of grepping raw Cloud Run logs and guessing which tenant was affected.

**FRs implemented:** none directly (foundation for all customer-web operational FRs)
**NFRs verified:** CLAUDE.md Enterprise Floor — Sentry instrumentation parity with API; customer-web matches the API's Sentry coverage that already exists at `apps/api/src/main.ts:7`

**Modules + packages touched:**
- `apps/customer-web/package.json` (add `@sentry/nextjs`)
- `apps/customer-web/sentry.client.config.ts` (new)
- `apps/customer-web/sentry.server.config.ts` (new)
- `apps/customer-web/sentry.edge.config.ts` (new)
- `apps/customer-web/instrumentation.ts` (new — Next.js 14 instrumentation hook)
- `apps/customer-web/next.config.mjs` (wrap config in `withSentryConfig`, configure source-map upload)
- `apps/customer-web/app/layout.tsx` (tenant context tag on Sentry scope)
- `.github/workflows/ship.yml` (add `SENTRY_AUTH_TOKEN` secret + source-map upload step in `build-customer-web` job)

**ADRs governing:** none new (operational concern, not architectural)
**Pattern rules honoured:** no PII in error payloads (Sentry `beforeSend` scrubber); tenant slug tagged on every event so multi-tenant triage is possible; source maps uploaded but not served publicly (Sentry-only)
**Complexity:** S (4h — single afternoon)

**Acceptance Criteria:**

**Given** the customer-web app is deployed to App Hosting
**When** an SSR route throws an uncaught exception (synthetic: a `/_test-error-do-not-link` route that calls `throw new Error('test')`)
**Then** the error appears in the Sentry project within 60 seconds
**And** the stack frame resolves to the original TypeScript line (source maps applied)
**And** the Sentry event carries the tenant slug as a tag (`tenant: <slug>`)
**And** no PII (phone numbers, email, customer names) appears in the event payload

**Given** a client-side error occurs in a browser component (synthetic: a `useEffect` throw)
**When** the user's browser reports it via the Sentry browser SDK
**Then** the same source-map resolution and tenant tagging applies

**Given** an error happens on a route handler (e.g. `app/sitemap.ts`)
**When** the route throws
**Then** the error reaches Sentry with `runtime: edge` or `runtime: nodejs` tagged correctly

**Given** the `SENTRY_AUTH_TOKEN` secret is missing from CI
**When** the `build-customer-web` job runs
**Then** the build fails with a clear error message ("SENTRY_AUTH_TOKEN required for source-map upload") and does NOT silently skip the upload

**Given** CI runs on this PR
**Then** typecheck + lint + Vitest + Semgrep all pass; Lighthouse CI a11y threshold (0.9 error) unaffected; `build-customer-web` job completes including source-map upload

**Tests required:**
- Unit: Sentry `beforeSend` PII scrubber (phone, email, name redacted; non-PII fields preserved)
- Integration: synthetic error route in dev mode confirms Sentry SDK initialisation (mocked transport)
- CI gate: `SENTRY_AUTH_TOKEN` presence check in `build-customer-web`

**Definition of Done:** All AC + `pnpm typecheck && pnpm lint && pnpm test:unit` green on PR + `.codex-review-passed` or substitute gate per `feedback_codex_limit_batch_strategy.md` + runtime smoke: deploy to a preview environment, hit `/_test-error-do-not-link`, confirm event arrives in Sentry with resolved source map + tenant tag, then delete the test route before merge.

**Out of scope:** Sentry on customer-mobile (that's 19.2). Performance monitoring / tracing (defer to a future story when traffic justifies). Sentry on shopkeeper or admin (already covered by api Sentry).

---

### Story 19.2 (T19.2): customer-mobile errors are captured by Sentry + Error Boundary

**Class:** B — observability wiring on a public surface; pairs with 19.1 but separate app, separate SDK.
**Wave:** 1 (P0) · **Worktree:** `C:/gs19-sentry-mob` · **Depends on:** none · **Blocks:** 19.6 (review gate)

**As an on-call engineer at Goldsmith**,
I want every JS-thrown error and every component render error in the customer-mobile app to land in Sentry with source maps and tenant + customer-phone-hash context,
So that production crashes on real customer devices are visible within minutes instead of being silent dead apps.

**FRs implemented:** none directly (foundation)
**NFRs verified:** CLAUDE.md Enterprise Floor — Sentry parity; no silent JS errors; React Error Boundary catches component throws that would otherwise white-screen the app

**Modules + packages touched:**
- `apps/customer-mobile/package.json` (add `@sentry/react-native`, `sentry-expo` if Expo SDK 51 still uses it; check current SDK guidance)
- `apps/customer-mobile/app.config.ts` (Sentry Expo plugin entry)
- `apps/customer-mobile/src/lib/sentry.ts` (new — init + PII scrubber + tenant tag setter)
- `apps/customer-mobile/app/_layout.tsx` (Sentry.init at root, wrap children in Sentry-wrapped ErrorBoundary)
- `apps/customer-mobile/src/components/RootErrorBoundary.tsx` (new — React class component + fallback UI in Hindi)
- `apps/customer-mobile/eas.json` (development/preview profiles get sentry-expo source-map upload via post-publish hook — production handled in 19.4)
- `.github/workflows/ship.yml` (validate Sentry env vars present in `build-customer-mobile` job)

**ADRs governing:** none new
**Pattern rules honoured:** no PII in error payloads (PII scrubber: phone numbers, OTPs, addresses); tenant tag set on every event; customer phone hashed (SHA-256) before tagging (never raw phone); ErrorBoundary fallback UI in Hindi per `feedback_no_color_only_signals.md` spirit (text + icon, not just colour)
**Complexity:** S (4h)

**Acceptance Criteria:**

**Given** a customer is using the app on a real device
**When** a JS error throws in a screen (synthetic: a hidden `/_test-error` deep link)
**Then** the error reaches Sentry within 60 seconds
**And** stack frames resolve to the original TypeScript source via Expo Updates source-map upload
**And** the event carries `tenant: <slug>` + `customer_phone_hash: <sha256(phone)[0:12]>` tags
**And** raw phone, OTP, address, name are NOT in the event payload

**Given** a React component throws during render (synthetic: a button that throws on press)
**When** the ErrorBoundary catches it
**Then** the user sees a Hindi fallback UI ("कुछ गलत हुआ — कृपया ऐप फिर खोलें") with a "रिपोर्ट भेजी गई" confirmation
**And** the error is captured in Sentry with `errorBoundary: true` tag
**And** the app does NOT white-screen

**Given** the customer is offline when the error occurs
**When** they come back online
**Then** the Sentry SDK retries the upload (built-in offline queue)

**Given** CI runs
**Then** the `build-customer-mobile` job validates Sentry env vars are present (fails if missing) and `pnpm typecheck && pnpm lint && pnpm test:unit` pass

**Tests required:**
- Unit: PII scrubber tests (phone, OTP, address redacted; non-PII preserved); phone-hash deterministic
- Component: ErrorBoundary renders Hindi fallback when child throws; reports to Sentry
- CI gate: Sentry env var presence check in `build-customer-mobile`

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: development build on a real Pixel emulator (the `Pixel_6_Pravesh` AVD per CLAUDE.md §"Customer mobile visual QA with Maestro"), trigger the `/_test-error` deep link, confirm event in Sentry with phone hash + tenant tag, confirm ErrorBoundary fallback renders Hindi text not blank screen. Delete `/_test-error` before merge.

**Out of scope:** Performance monitoring / spans (defer). Native crash reporting (sentry-react-native handles natively; explicit Android crash test deferred to 19.4 EAS production build verification).

---

### Story 19.3 (T19.3): apphosting.yaml is populated for the first tenant and deploys

**Class:** B — infra config + Firebase App Hosting deploy verification; no application logic change.
**Wave:** 1 (P0) · **Worktree:** `C:/gs19-apphost` · **Depends on:** none · **Blocks:** 19.6 (review gate); enables all customer-web work to reach a real URL

**As Alok (agency owner deploying for the first paying tenant)**,
I want `apps/customer-web/apphosting.yaml` populated with real env vars and a verified App Hosting deploy producing a reachable URL,
So that the first jeweller's customers can actually hit the storefront instead of looking at a 404.

**FRs implemented:** none directly (operationalises FR82–FR140 by making the storefront reachable)
**NFRs verified:** NFR-C7 (data residency — App Hosting backend in India-compliant region per ADR-0015); NFR-S1 (TLS 1.3 served by Firebase Hosting by default)

**Modules + packages touched:**
- `apps/customer-web/apphosting.yaml` (replace every `REPLACE_WITH_*` placeholder with real values for the first deployment target)
- `apps/customer-web/.env.example` (document the env vars that must be set per tenant)
- `docs/runbook.md` (new §"App Hosting deploys" — first-deploy + rollout + rollback steps)
- `docs/runbook.md` (new §"Tenant onboarding — App Hosting backend per tenant" — placeholder pointing to a future productisation story)

**ADRs governing:** ADR-0015 (Azure + Firebase stack — App Hosting is the Firebase customer-web target per CLAUDE.md)
**Pattern rules honoured:** secrets via Firebase Secret Manager, never inline in apphosting.yaml; `NEXT_PUBLIC_*` env vars only for non-secret values; min/max instance counts respect startup-economics-first floor (memory `feedback_startup_economics_first.md` — scale-to-zero on)
**Complexity:** S (4h, including the actual deploy + smoke)

**Acceptance Criteria:**

**Given** the apphosting.yaml has been populated for the first tenant (anchor or first signed customer)
**When** `firebase deploy --only apphosting` runs from the project root
**Then** the deploy completes successfully (App Hosting backend created or updated)
**And** the resulting URL serves the customer-web homepage
**And** the homepage renders the tenant's branding (logo, colours, Hindi-first typography) per `apps/customer-web/lib/theme.ts` resolution

**Given** the apphosting.yaml still has any `REPLACE_WITH_*` placeholder when committed
**When** CI runs
**Then** a pre-commit / CI grep gate fails the build ("apphosting.yaml contains unresolved placeholder")

**Given** the tenant slug or API URL is wrong in apphosting.yaml
**When** the App Hosting backend starts
**Then** the customer-web SSR layer fails fast with a clear error in Cloud Logging (not a silent 200 with empty data)

**Given** secrets (Firebase config) are referenced in apphosting.yaml
**When** the deploy runs
**Then** they resolve from Firebase Secret Manager (`secret:NAME` syntax), NOT from inline env strings

**Given** the runbook section is added
**Then** it contains: first-deploy steps, env-var matrix, rollback (revert to previous backend revision), tenant-add procedure stub, and the Cloud Logging URL pattern for SSR error triage

**Tests required:**
- CI gate: grep for `REPLACE_WITH_` in `apps/customer-web/apphosting.yaml` returns 0 matches (build fails if not 0)
- Manual: live deploy + URL smoke (curl + browser visit) — documented in runbook

**Definition of Done:** All AC + runbook section merged + live App Hosting URL reachable + `.codex-review-passed` or substitute gate. Smoke test: visit the deployed URL, confirm homepage renders, confirm `/products` browse works against the live API, confirm tenant branding applied. Record the URL in the runbook (not in git — link to internal doc).

**Out of scope:** Automated per-tenant App Hosting backend provisioning (productisation story, defer). Custom domain wiring (deferred until tenant signs SOW with their preferred domain). CDN/edge caching tuning beyond Firebase defaults.

---

### Story 19.4 (T19.4): eas.json production profile is populated and EAS production build succeeds

**Class:** B — infra config + EAS build verification; no application logic change.
**Wave:** 1 (P0) · **Worktree:** `C:/gs19-eas` · **Depends on:** none · **Blocks:** 19.6 (review gate); enables installable production APK/IPA

**As Alok (agency owner shipping the first paying tenant's app)**,
I want `apps/customer-mobile/eas.json` production profile populated with real package name, bundle ID, and env vars, and a verified `eas build --profile production --platform android` producing a signed APK,
So that the first jeweller's customers can install the app from the Play Store under the jeweller's brand.

**FRs implemented:** none directly (operationalises every customer-mobile FR by making the app installable)
**NFRs verified:** NFR-C7 (data residency — production API URL points to India-region Cloud Run); white-label rule (production bundle ID + package name are tenant-specific, not generic `goldsmith`)

**Modules + packages touched:**
- `apps/customer-mobile/eas.json` (populate `build.production`: distribution, channel, env vars, credentials source)
- `apps/customer-mobile/app.config.ts` (verify production validation guards already in place — per audit §2 they reject `.dev` bundles — wire to actual prod values for first tenant)
- `apps/customer-mobile/credentials.json` (new — points to keystore stored in EAS, not in repo)
- `apps/customer-mobile/google-services.json` (must NOT be committed; documented in `.gitignore` and runbook)
- `apps/customer-mobile/GoogleService-Info.plist` (same — never committed)
- `docs/runbook.md` (new §"EAS production builds" — first-build + Play Store submission + iOS submission steps)

**ADRs governing:** ADR-0015 (Azure + Firebase stack); white-label tenant config per `feedback_shopkeeper_self_service_config.md` spirit (per-tenant bundle ID)
**Pattern rules honoured:** keystore credentials in EAS Vault (never in repo); GoogleService-Info.plist + google-services.json kept out of git; production API URL uses HTTPS only (no `http://` allowed per app.config.ts production guard)
**Complexity:** S (4h, plus EAS build time)

**Acceptance Criteria:**

**Given** the eas.json production profile is populated for the first tenant
**When** `eas build --profile production --platform android --non-interactive` runs
**Then** the build completes successfully (signed APK or AAB produced)
**And** the build artifact carries the tenant's package name (e.g. `com.<jeweller>.customer`), NOT `com.goldsmith.customer`
**And** the bundled JS references the production API URL (HTTPS, India-region Cloud Run host), NOT a localhost or .dev URL
**And** `EXPO_PUBLIC_DEV_AUTH` is unset or absent in the production bundle

**Given** the eas.json production profile is missing any required field
**When** `eas build --profile production` runs
**Then** the build fails fast with a clear error (NOT a silent build with missing credentials)

**Given** a developer accidentally tries to set the production API URL to `http://` (insecure)
**When** the app.config.ts production guard runs at build time
**Then** the build fails per the existing validation per audit §2

**Given** the runbook section is added
**Then** it contains: first-build steps, EAS credentials setup, Play Store submission steps, iOS App Store submission steps (deferred OK), version bump conventions, rollback procedure (Play Store rollback to previous APK)

**Tests required:**
- Unit: app.config.ts production validation (already exists per audit §2; add a test if missing for `EXPO_PUBLIC_API_BASE_URL.startsWith('https://')` and bundle ID doesn't end in `.dev`)
- Manual: `eas build --profile production --platform android --non-interactive` produces a signed APK; install on a real device; confirm bundle ID + API URL at runtime via dev menu

**Definition of Done:** All AC + runbook section merged + a successful production build artifact + `.codex-review-passed` or substitute gate. Smoke test: install the production APK on a real Android device, complete OTP login against production Firebase, browse a product, confirm tenant branding applied, confirm Sentry events fire to production project (verifies 19.2 + 19.4 together).

**Out of scope:** iOS production build (defer until anchor signs and Apple Developer enrolment completes — flagged in CLAUDE.md §External blockers). Play Store submission automation (manual for first tenant). OTA update channel strategy (defer; default Expo Updates channel OK for MVP).

---

### Story 19.5 (T19.5): cloudbuild.yaml deploys the API to Cloud Run and rollback is runbook'd

**Class:** B — infra config + deploy automation; no application logic change.
**Wave:** 1 (P0) · **Worktree:** `C:/gs19-cloudrun` · **Depends on:** none · **Blocks:** 19.6 (review gate); enables zero-touch API deploys

**As Alok (agency owner)**,
I want `cloudbuild.yaml` to not just build the API Docker image but also deploy it to Cloud Run, and a runbook section documenting rollback by revision switch,
So that API ships are predictable and reversible without me running gcloud commands by memory.

**FRs implemented:** none directly (operationalises every API FR by making deploys reliable)
**NFRs verified:** NFR-C7 (data residency — Cloud Run service in asia-south1 India-compliant region); NFR-OPS — deploy reversibility (rollback ≤ 5 minutes)

**Modules + packages touched:**
- `cloudbuild.yaml` (add `gcloud run deploy` step after the Docker build + Artifact Registry push)
- `cloudbuild.yaml` (add explicit traffic-shift step — gradual rollout to 10% → 50% → 100% over a short window OR keep 100% on tag for now and document gradual rollout as a future story)
- `apps/api/Dockerfile` (no change expected; verify HEALTHCHECK is present so Cloud Run revision health gating works)
- `apps/api/src/main.ts` (verify `/health` endpoint exists and returns 200 with DB connectivity check; add if missing)
- `docs/runbook.md` (new §"Cloud Run deploys" — deploy steps, traffic shift, rollback by `gcloud run services update-traffic --to-revisions=<old>=100`, log query pattern, alert configuration pointer)
- `.github/workflows/ship.yml` (optional — trigger Cloud Build on main push if not already; or document Cloud Build trigger config)

**ADRs governing:** ADR-0015 (Azure + Firebase stack; but API runs on Cloud Run per recent commits) — note in commit message that API target is GCP Cloud Run despite ADR-0015's Azure preference (operational decision per memory)
**Pattern rules honoured:** secrets via Secret Manager (never inline); minimum instances respects startup-economics-first floor (scale-to-zero allowed); health check gating prevents broken revisions from receiving traffic
**Complexity:** M (6h, including the actual first deploy + rollback drill)

**Acceptance Criteria:**

**Given** a commit lands on main
**When** Cloud Build triggers
**Then** it builds the Docker image, pushes to Artifact Registry, AND deploys to Cloud Run in asia-south1
**And** the new revision passes the `/health` probe before receiving 100% traffic
**And** if the health probe fails, traffic stays on the previous revision (no rollback needed because the new revision never received traffic)

**Given** a deployed revision is broken (e.g. throws on every request)
**When** the on-call engineer follows the runbook's rollback steps
**Then** within 5 minutes traffic is back on the previous good revision via `gcloud run services update-traffic`
**And** the rollback is logged in the deploy log

**Given** the `/health` endpoint is hit
**Then** it returns 200 with a body confirming DB connectivity (`{ status: 'ok', db: 'ok' }`) within 1 second
**And** if DB is unreachable it returns 503

**Given** the runbook section is added
**Then** it contains: deploy trigger steps, traffic-shift conventions, rollback recipe (exact `gcloud` command), log query for "errors on new revision", alert recipient pointer

**Tests required:**
- Unit: `/health` endpoint returns 200 + db: 'ok' when DB pool is healthy; 503 when DB pool is unreachable (mocked)
- Manual: trigger a Cloud Build run, confirm deploy completes; run a rollback drill against a non-production revision

**Definition of Done:** All AC + runbook section merged + a successful Cloud Build → Cloud Run deploy + a successful rollback drill + `.codex-review-passed` or substitute gate. Document the live API URL in the runbook (internal doc).

**Out of scope:** Gradual traffic shifting (10%/50%/100%) — defer to a future operational story. Multi-region failover — defer per startup-economics-first. Automated rollback on Sentry error-rate spike — defer.

---

### Story 19.6 (T19.6): codex review + /security-review pass on HEAD covering deploy surface

**Class:** A — full review gate on the deployment surface that has never been security-reviewed (per audit §3 finding #1: `.security-review-passed` is stale).
**Wave:** 1 (P0) · **Worktree:** main (this is a review gate, not a feature) · **Depends on:** 19.1, 19.2, 19.3, 19.4, 19.5 all merged · **Blocks:** any production deploy

**As Alok (agency owner)**,
I want `codex review --base main` AND `/security-review` to both pass on the current HEAD after the P0 deploy unblockers merge,
So that the deployment surface (App Hosting config, EAS production profile, Cloud Run deploy step, Sentry SDKs on customer apps) has been independently reviewed before any paying tenant sees a real URL.

**FRs implemented:** none directly (process gate)
**NFRs verified:** CLAUDE.md Class A review gate; `.codex-review-passed` + `.security-review-passed` markers fresh and covering HEAD

**Modules + packages touched:**
- `.codex-review-passed` (refresh marker with HEAD SHA + commit range covered)
- `.security-review-passed` (refresh marker with HEAD SHA + commit range covered)
- No code changes expected (if Codex or /security-review surface findings, those are fixed in follow-up commits on this branch before the marker is written)

**ADRs governing:** none new; CLAUDE.md per-class protocol
**Pattern rules honoured:** Class A review gate runs Codex + /security-review in parallel per CLAUDE.md `Class A — full ceremony` §4; both markers required before push
**Complexity:** S (4h, plus any fix-up rounds; budget 2–3 rounds per `feedback_codex_iteration_depth_for_structural_code.md`)

**Acceptance Criteria:**

**Given** stories 19.1–19.5 have merged to main
**When** `codex review --base main` runs from a fresh checkout
**Then** it returns zero P0/P1 findings (P2/P3 findings tracked as follow-up if any)

**Given** `/security-review` runs on the same HEAD
**Then** it returns zero P0/P1 findings (P2/P3 findings tracked as follow-up if any)

**Given** Codex or /security-review surfaces a P0/P1 finding
**When** the issue is fixed in a follow-up commit
**Then** the review is re-run on the fixed HEAD and must pass before markers are written

**Given** the markers are written
**Then** each marker contains: HEAD SHA, commit range covered, date, reviewer (Codex / Claude /security-review)
**And** the markers are committed to the repo (per CLAUDE.md convention)

**Tests required:** N/A (this is a review gate, not a code change)

**Definition of Done:** Both markers refreshed on HEAD + zero P0/P1 findings remaining + merge to main. If Codex weekly limit is hit, per `feedback_codex_limit_batch_strategy.md`, hold for limit reset (do not substitute /security-review for Codex on Class A).

**Out of scope:** Re-reviewing pre-19.1 code (focus is the deploy surface). Pentest (deferred per CLAUDE.md startup-economics-first to first-paying-tenant graduation trigger).

---

### Story 19.7 (T19.7): customers can delete their account end-to-end (DPDPA Right to Erasure)

**Class:** A — auth + RLS + cascade delete + audit + customer-facing UI on both apps; touches encryption (encrypted PII columns must be wiped per DPDPA); regulatory.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-dpdpa` · **Depends on:** none (cross-cutting; serial alone per `feedback_fresh_session_prompt_ceremony.md` context-quarantine rule for Class A auth/RLS work)

**As a customer of any jeweller**,
I want to permanently delete my account and all my data from both apps with a clear confirmation flow,
So that the jeweller is DPDPA-compliant and I can exercise my Right to Erasure without contacting support.

**FRs implemented:** Customer-side DPDPA Right to Erasure (regulatory FR carried forward from PRD §Compliance — operationalised end-to-end across API + mobile + web)
**NFRs verified:** NFR-S* (PII wiped from primary storage); NFR-S9 (deletion audit-logged with actor + timestamp + reason); NFR-C* (DPDPA compliance; verifiable from audit log)

**Modules + packages touched:**
- migration `0075_customer_deletion.sql` (new — add `deleted_at TIMESTAMPTZ`, `deletion_reason TEXT`, `deletion_actor TEXT` to `customers` table; RLS policy update to exclude `deleted_at IS NOT NULL` from selectable rows by default; cascade-soft-delete or hard-delete decision documented in migration comment)
- `apps/api/src/modules/customer/customer.controller.ts` (new endpoint: `DELETE /api/v1/customer/me` with CustomerAuthGuard; accepts optional `reason` in body)
- `apps/api/src/modules/customer/customer.service.ts` (new method: `deleteSelf(customerId, shopId, reason)` — soft-delete customers row, anonymise encrypted PII fields, cascade-delete wishlist, cascade-delete reviews (or anonymise authorship), retain invoices for statutory retention with customer FK nulled or anonymised, audit-log the deletion)
- `apps/api/src/modules/customer/customer.repository.ts` (cascade queries + RLS-safe deletes)
- `apps/api/src/modules/wishlist/wishlist.repository.ts` (handle cascade)
- `apps/api/src/modules/reviews/reviews.repository.ts` (anonymise authorship, not delete — preserves review for other shoppers per "right to be forgotten but not right to rewrite history" balance; document this in migration comment + runbook)
- `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.repository.ts` (cancel active bookings on deletion)
- `apps/customer-mobile/app/profile/delete-account.tsx` (new — Hindi-first confirmation screen with: explanation, reason picker, "टाइप करें: मेरा डेटा मिटाएँ" confirmation, irreversible warning, success state with re-login prevention)
- `apps/customer-mobile/src/api/endpoints.ts` (add `deleteCustomerAccount` axios call)
- `apps/customer-web/app/profile/delete-account/page.tsx` (new — parallel web flow)
- `apps/customer-web/lib/api.ts` (add `deleteCustomerAccount` SSR + client call)
- `docs/runbook.md` (new §"DPDPA Right to Erasure" — operational runbook for handling customer requests including audit-trail query)

**ADRs governing:** ADR-0008 (multi-tenant isolation — deletion scoped to single tenant); ADR-0011 (compliance package hard-block gateway — DPDPA deletion is a hard requirement)
**Pattern rules honoured:** soft-delete + PII anonymisation (not hard-delete) for retainable rows (invoices); hard-delete for ephemeral rows (wishlist); cascade safety verified via tenant-isolation test; `auditLog(this.pool, { action: 'CUSTOMER_DELETED', ... })` per `feedback_audit_pattern_pool_not_tx.md`; no PII in audit log payload (hashed phone only)
**Complexity:** L (12h — Class A with full ceremony; expect 2–3 Codex iteration rounds per `feedback_codex_iteration_depth_for_structural_code.md`)

**Acceptance Criteria:**

**Given** a customer (Priya, phone +91-98765-43210) is signed in on customer-mobile
**When** she navigates to Profile → Delete Account, picks a reason ("मुझे ज़रूरत नहीं"), types the confirmation phrase "मेरा डेटा मिटाएँ", and taps "हाँ, मिटाएँ"
**Then** the app calls `DELETE /api/v1/customer/me` with her Firebase ID token
**And** the API soft-deletes her `customers` row (sets `deleted_at`, `deletion_reason`, `deletion_actor='self'`)
**And** her encrypted PII fields (`pan_encrypted`, `address_encrypted`) are wiped (set to NULL)
**And** her wishlist rows are hard-deleted (cascade)
**And** her reviews are anonymised (author name set to "एक ग्राहक", customerId set to NULL on review rows) — NOT deleted
**And** her active rate-lock bookings are cancelled with refund triggered if applicable
**And** an audit log entry is written: `action: 'CUSTOMER_DELETED', actor: 'self', subject_type: 'customer', subject_id: <id>, after: { reason, phone_hash: sha256(phone)[:12] }` — no raw PII in payload
**And** the app signs her out and shows a Hindi success screen ("आपका खाता मिटा दिया गया है")
**And** subsequent OTP login with the same phone creates a NEW customer row (the deleted row is not re-activated)

**Given** the same flow runs from customer-web
**Then** the same behaviour holds (same API endpoint, same cascade, same audit log)

**Given** Priya's customer is for shop A
**When** she requests deletion
**Then** ONLY shop A's customer row is affected (if she happens to be a customer of shop B with the same phone — different shop_id — that row is untouched)
**And** the tenant-isolation test confirms no cross-tenant deletion happens

**Given** Priya attempts to delete a second time after deletion (with a stale token)
**When** the API receives the request
**Then** it returns 404 (the customer row is `deleted_at IS NOT NULL` and RLS excludes it from the default scope)

**Given** an operator queries the audit log for compliance
**When** they filter by `action = 'CUSTOMER_DELETED'`
**Then** they see the deletion event with hashed phone, reason, actor, timestamp — sufficient to answer "did this customer exercise erasure"

**Given** the deletion endpoint is called without a valid Firebase ID token
**Then** the CustomerAuthGuard rejects with 401 (no anonymous deletion)

**Given** CI runs
**Then** typecheck + lint + unit + integration + tenant-isolation tests all pass; Semgrep clean; `.codex-review-passed` + `.security-review-passed` markers both refreshed

**Tests required:**
- Unit: cascade logic per repository (wishlist hard-delete, reviews anonymise, rate-lock cancel)
- Integration: end-to-end DELETE call exercises full cascade against test DB; subsequent OTP login creates new customer row not re-activation
- Tenant-isolation: same phone exists in shop A + shop B; deletion in shop A does not affect shop B
- Security: deletion without auth → 401; deletion with another customer's token → 403/404; replay of deletion idempotent (second call → 404 not double-delete)
- Audit: deletion event has correct structure, no PII in payload, hash is deterministic

**Definition of Done:** All AC + 10 CI gates + `.codex-review-passed` + `.security-review-passed` markers + runtime smoke on customer-mobile emulator (per Maestro setup in CLAUDE.md) AND customer-web preview deployment AND a manual audit-log query confirming the event lands. Runbook §DPDPA Right to Erasure merged with the audit query recipe.

**Out of scope:** Data export (Right to Portability — separate FR if needed). Account anonymisation as an alternative to deletion (defer). Admin-initiated deletion (defer; current flow is customer-self-initiated only). Bulk deletion / deletion-by-shop (defer — handled by tenant termination, separate story).

---

### Story 19.8 (T19.8): customer-web wishlist persists to backend (not localStorage)

**Class:** B — replaces a localStorage-only client surface with backend-persisted wishlist; pairs with auth (Firebase ID token); new attack surface? — no, the endpoint exists already (`POST /api/v1/wishlist`); we're just wiring the web client to it.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-wishlist-web` · **Depends on:** 19.1 (Sentry — so write-path errors are captured)

**As a customer browsing on customer-web on my desktop**,
I want my wishlist to persist across devices and sessions when I'm signed in,
So that the heart icon I tapped on my phone also shows on my laptop, and a page refresh doesn't lose my saved pieces.

**FRs implemented:** FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50 (wishlist closure on web — only mobile currently meets these)
**NFRs verified:** parity with customer-mobile wishlist UX (already backend-persisted there); RLS-scoped (wishlist already has shop_id scoping per audit §3)

**Modules + packages touched:**
- `apps/customer-web/app/wishlist/page.tsx` (replace localStorage with API calls; gate by Firebase auth state; redirect to sign-in if not authed)
- `apps/customer-web/lib/api.ts` (add wishlist endpoints: `addToWishlist`, `removeFromWishlist`, `getWishlist`)
- `apps/customer-web/lib/auth.ts` (verify Firebase ID token retrieval for API auth header; add if not present)
- `apps/customer-web/components/products/WishlistButton.tsx` (refactor to use API + optimistic update + auth gate; show "साइन इन करें" if not authed)
- `apps/customer-web/components/products/ProductCard.tsx` (consume new WishlistButton)
- `apps/customer-web/app/(auth)/sign-in/page.tsx` (new or existing — confirm exists; if missing, add Firebase phone OTP flow parallel to mobile)
- `apps/customer-web/middleware.ts` (verify route protection if any; not strictly required since wishlist is API-gated)

**ADRs governing:** ADR-0001 (Firebase Auth); ADR-0008 (multi-tenant isolation — wishlist is RLS-scoped)
**Pattern rules honoured:** Bearer = Firebase ID token (no own JWT per ADR-0016); optimistic update + rollback on error; no PII in localStorage (kill the localStorage fallback entirely — don't dual-write)
**Complexity:** M (6h)

**Acceptance Criteria:**

**Given** a customer is signed in via Firebase phone OTP on customer-web
**When** they tap the heart icon on a PDP
**Then** the wishlist API is called with their Firebase ID token + tenant slug
**And** the row appears in `wishlist` table with their customer_id + product_id + shop_id
**And** the heart icon shows filled state optimistically before the API responds
**And** if the API errors, the heart unfills and a Hindi toast appears ("इच्छा सूची में जोड़ नहीं पाए")

**Given** the same customer signs in on customer-mobile later
**Then** their wishlist contains the items added on web

**Given** the same customer refreshes the web page
**Then** their wishlist still shows the items (persisted, not localStorage)

**Given** a customer is NOT signed in
**When** they tap a heart icon
**Then** they see a Hindi sign-in prompt sheet ("इच्छा सूची सहेजने के लिए साइन इन करें")
**And** after sign-in they return to the product and the heart is tappable

**Given** a customer deletes their account (per 19.7)
**Then** their wishlist rows are hard-deleted per 19.7 cascade

**Given** CI runs
**Then** typecheck + lint + Vitest + Lighthouse a11y all pass

**Tests required:**
- Unit: WishlistButton renders auth-gated vs auth'd states correctly; optimistic update + rollback logic
- Integration: API call with mocked Firebase token writes to wishlist; subsequent GET returns it
- E2E (manual or Playwright if landed by then): sign-in → add to wishlist → refresh → still there → sign out → wishlist UI prompts sign-in

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: deploy preview, complete OTP, add wishlist item, refresh, verify persistence, verify cross-device sync against the mobile app (same phone, same tenant).

**Out of scope:** Wishlist sharing (defer). Wishlist export (defer). Anonymous wishlist (explicitly NOT supported — sign-in required, per FR43–FR50 spec).

---

### Story 19.9 (T19.9): customer-web /profile shows a real timeline (purchases + try-at-home + rate-locks)

**Class:** B — replaces a placeholder stub with a real timeline view; reuses existing API endpoints (`GET /api/v1/customer/purchases`, `GET /api/v1/customer/rate-lock/bookings`, `GET /api/v1/customer/try-at-home/bookings`); no new attack surface.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-profile-web` · **Depends on:** 19.1 (Sentry) and 19.8 (so wishlist is part of the profile surface and works end-to-end)

**As a customer browsing on customer-web on my desktop**,
I want to see my purchase history, my try-at-home bookings, and my rate-lock bookings in one timeline view on /profile,
So that I don't have to switch to the mobile app to check what I've bought or booked from this jeweller.

**FRs implemented:** FR96 (customer order/booking history surfaced on web in addition to mobile)
**NFRs verified:** parity with customer-mobile profile timeline (already exists per audit §2)

**Modules + packages touched:**
- `apps/customer-web/app/profile/page.tsx` (replace "online account soon" stub with real Suspense-bounded timeline; gate by Firebase auth)
- `apps/customer-web/app/profile/loading.tsx` (new — skeleton)
- `apps/customer-web/app/profile/error.tsx` (verify exists or add)
- `apps/customer-web/components/profile/TimelineTabs.tsx` (new — tabs for purchases / try-at-home / rate-locks / wishlist)
- `apps/customer-web/components/profile/PurchasesTab.tsx` (new — fetches purchase history server-side, renders cards)
- `apps/customer-web/components/profile/TryAtHomeTab.tsx` (new)
- `apps/customer-web/components/profile/RateLocksTab.tsx` (new)
- `apps/customer-web/lib/api.ts` (add server-side fetchers: `fetchCustomerPurchases`, `fetchCustomerTryAtHome`, `fetchCustomerRateLocks`)
- `apps/customer-web/lib/auth.ts` (server-side Firebase ID token validation for SSR fetches)
- `packages/customer-shared` (if shared types are needed for purchase/booking shapes, add them — but the API already serialises these; likely no new types needed)

**ADRs governing:** ADR-0001 (Firebase Auth — SSR token validation); ADR-0008 (multi-tenant isolation — endpoints already RLS-scoped)
**Pattern rules honoured:** SSR with auth-gated redirect (unauth → /sign-in); Hindi-first labels; skeleton on loading; empty states per tab ("कोई खरीद नहीं", "कोई बुकिंग नहीं"); cards link to PDP or invoice detail; no PII over-fetched (only what's needed to render)
**Complexity:** L (12h)

**Acceptance Criteria:**

**Given** a signed-in customer visits `/profile`
**When** the page renders
**Then** they see four tabs: खरीद / ट्राय-एट-होम / रेट-लॉक / इच्छा सूची
**And** the default tab (खरीद) loads server-side with their purchase history (paginated, latest first)
**And** each card shows: date, invoice number, product summary, total amount in INR, link to a (future or existing) invoice detail page

**Given** the customer clicks the ट्राय-एट-होम tab
**Then** their try-at-home bookings render with status (PENDING / DISPATCHED / RETURNED), date, product list, dispatch+return dates

**Given** the customer clicks the रेट-लॉक tab
**Then** their rate-lock bookings render with locked rate, lock expiry, status (ACTIVE / EXPIRED / FULFILLED / CANCELLED), deposit amount

**Given** the customer clicks the इच्छा सूची tab
**Then** the existing wishlist UI from 19.8 renders here too (component reuse)

**Given** a customer has no purchases yet
**When** they open the खरीद tab
**Then** they see an empty state in Hindi ("अभी तक कोई खरीद नहीं हुई — ब्राउज़ शुरू करें") with a CTA back to `/products`

**Given** a customer is NOT signed in
**When** they visit `/profile`
**Then** they are redirected to `/sign-in?returnTo=/profile`
**And** after sign-in they land back on `/profile`

**Given** the API errors on any tab fetch
**Then** that tab shows a Hindi error state ("लोड नहीं हो पाया — फिर कोशिश करें") with a retry button
**And** the other tabs continue to work independently

**Given** CI runs
**Then** typecheck + lint + Vitest + Lighthouse perf ≥ 0.8 + a11y ≥ 0.9 pass

**Tests required:**
- Unit: each tab renders empty state when API returns empty; each tab renders error state on API throw; auth-gate redirect logic
- Integration: SSR fetch with mocked Firebase token + mocked API response renders correctly
- A11y: tab navigation works with keyboard (Left/Right arrow keys); ARIA roles (`tablist`, `tab`, `tabpanel`) present

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: deploy preview, complete OTP, accumulate a purchase + try-at-home + rate-lock (against test data), confirm all three tabs render correctly, refresh, confirm persistence.

**Out of scope:** Invoice detail page (existing or future story; this story just links to it). Filtering / search within tabs (defer). Cross-shop "all my purchases across all jewellers" view (out-of-scope per multi-tenant isolation rules — customers are per-shop entities). PDF download of invoices on web (defer; mobile has it).

---

### Story 19.10 (T19.10): customer-web /products FilterPanel is complete

**Class:** B — UI completeness on an existing page; no new API; no compliance surface.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-filter-web` · **Depends on:** none (parallel with anything else customer-web that doesn't touch FilterPanel)

**As a customer browsing /products on customer-web**,
I want to filter by purity (22K/18K), price band, in-stock toggle, occasion, and gift persona using visible chips — not just metal and collection,
So that I can narrow down a 200-product catalogue to what's relevant without having to know URL query syntax.

**FRs implemented:** FR82 (browse), FR83 (filter), FR84 (sort) — closure of UI gaps where backend already supports the filter (per audit §1 critical gap #5)
**NFRs verified:** NFR-A4, NFR-A6 (a11y on filter chips); NFR-P* (filter changes update results within 500ms via existing API)

**Modules + packages touched:**
- `apps/customer-web/components/FilterPanel.tsx` (add chips for purity, price-band, in-stock toggle, occasion, gift-persona)
- `apps/customer-web/app/products/page.tsx` (verify all chip values map to existing URL query params — no API change needed)
- `apps/customer-web/components/FilterChip.tsx` (new or existing — reusable chip primitive with active/inactive states, ARIA pressed state)
- `apps/customer-web/lib/catalog-filter-options.ts` (new — canonical filter option lists: purity ['22K', '18K', '14K'], price bands, occasions, gift personas — sourced from shared types or hardcoded with comments pointing to PRD)

**ADRs governing:** none new
**Pattern rules honoured:** chip components are keyboard-accessible (focus-visible outline, Space/Enter to toggle); ARIA `pressed` state; chip labels Hindi-first; URL is the source of truth for filter state (chips reflect URL, not local state); "Clear all" button if any chip is active
**Complexity:** S (4h)

**Acceptance Criteria:**

**Given** a customer is on `/products`
**When** the page renders
**Then** they see filter chip groups labelled in Hindi: धातु / शुद्धता / दाम / मौजूद / अवसर / उपहार
**And** each chip is keyboard-accessible (Tab focuses, Space/Enter toggles, ARIA `pressed` reflects state)

**Given** a customer taps "22K" under शुद्धता
**Then** the URL updates with `?purity=22K`
**And** the product grid re-fetches and shows only 22K products
**And** the result count updates with `aria-live="polite"`

**Given** a customer taps "10K-50K" under दाम (price band)
**Then** the URL updates with `?priceMin=10000&priceMax=50000` (or equivalent existing param shape)
**And** the grid filters accordingly

**Given** a customer toggles "मौजूद" (in-stock)
**Then** the URL adds `?inStock=true` and the grid filters to in-stock only

**Given** a customer has multiple chips active
**When** they tap "सभी साफ़ करें" (Clear all)
**Then** all chips deactivate and the URL drops all filter params (sort param preserved)

**Given** a customer lands on a URL with filter params already set (e.g. shared link)
**When** the page loads
**Then** the chips reflect the URL state (active chips visibly active)

**Given** Lighthouse runs in CI on `/products`
**Then** a11y score stays ≥ 0.9 and perf stays ≥ 0.8

**Tests required:**
- Unit: chip component active/inactive ARIA states; click → URL update; URL → chip state synchronisation
- Integration: page-level filter combinations produce correct query params and re-fetch
- A11y: keyboard navigation works through all chip groups; ARIA `pressed` correct on all states

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: deploy preview, exercise every chip type, confirm URL + grid behaviour, confirm "Clear all" works, confirm shared filter URLs work.

**Out of scope:** Saved filters (defer). Filter persistence per customer (defer). Filter chip count badges showing how many products match (defer; result count is enough for MVP).

---

### Story 19.11 (T19.11): customer-mobile colours route through tenant theme, not hardcodes

**Class:** B — multi-tenant correctness fix on the highest-traffic screens; no compliance surface; touches UI tokens.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-theme-mob` · **Depends on:** none (parallel with anything else customer-mobile that doesn't touch browse / rate-lock / try-at-home colours)

**As a customer of any non-anchor jeweller**,
I want the browse, rate-lock, and try-at-home screens in customer-mobile to render in MY jeweller's brand colour (e.g. emerald, ruby, sapphire), NOT the anchor's gold,
So that when I open the app I see my jeweller's brand and not what looks like a different shop's app.

**FRs implemented:** white-label rule per CLAUDE.md §"White-label multi-tenant theming"
**NFRs verified:** NFR-A* (visual brand correctness); WCAG contrast preserved when tenant colour applied (existing `@goldsmith/ui-tokens` should handle this; verify)

**Modules + packages touched:**
- `apps/customer-mobile/app/(tabs)/browse.tsx:26–27` (remove `PRIMARY_DEEP`, `PRIMARY_WASH` literals; replace with `useTenantStore().branding.primaryColor` resolved via `@goldsmith/ui-tokens` helper)
- `apps/customer-mobile/app/rate-lock/index.tsx` (remove green success colour hardcode; use semantic token `colors.success` from `@goldsmith/ui-tokens`)
- `apps/customer-mobile/app/try-at-home/index.tsx` (same)
- `apps/customer-mobile/src/hooks/useTenantTheme.ts` (new or existing — hook returning resolved tenant theme values; ensure it exists and is consumed)
- `packages/ui-tokens/src/derive-tenant-theme.ts` (new or existing — `deriveTenantTheme(tenant.branding.primaryColor)` returns `{ primary, primaryWash, primaryDeep, onPrimary }` with WCAG contrast verification, mirroring `apps/customer-web/lib/theme.ts:28–45`)
- `tools/semgrep/goldsmith-no-hardcoded-colors.yml` (new — Semgrep rule: hex colour literals in `apps/customer-mobile/app/**` are flagged; allowlist for `_layout.tsx` system colours)

**ADRs governing:** ADR-0008 (multi-tenant isolation — brand isolation is part of tenant isolation)
**Pattern rules honoured:** no hex literals in customer-mobile screens (Semgrep enforces); semantic colour tokens only; WCAG contrast preserved per the customer-web pattern; tenant.branding.primaryColor is the source of truth
**Complexity:** S (4h)

**Acceptance Criteria:**

**Given** a customer of tenant A (primary colour gold `#B58A3C`) opens the app
**When** they navigate to browse / rate-lock / try-at-home
**Then** the primary action buttons + accent strokes render in gold

**Given** a customer of tenant B (primary colour emerald `#0F766E`) opens the app
**When** they navigate to the same screens
**Then** the primary action buttons + accent strokes render in emerald
**And** WCAG contrast vs background is verified ≥ 4.5:1 (or fallback to ink if not)

**Given** any developer adds a hex colour literal to a file under `apps/customer-mobile/app/**`
**When** CI runs Semgrep
**Then** the build fails with a clear message pointing to the line and suggesting the token replacement

**Given** the success colour on rate-lock confirmation is rendered
**Then** it comes from `colors.success` (semantic token), not a green hex literal

**Given** CI runs
**Then** typecheck + lint + unit tests pass; Semgrep enforces the new rule on this PR (positive + negative test fixtures shipped)

**Tests required:**
- Unit: `deriveTenantTheme` returns expected token values for known tenant colour inputs; falls back to ink on low-contrast inputs
- Semgrep: positive fixture (hex literal in app/) fails; negative fixture (token usage) passes
- Visual: render browse/rate-lock/try-at-home with tenant A vs tenant B colours, confirm visual diff via screenshot (Maestro or manual)

**Definition of Done:** All AC + green CI + Semgrep rule active + `.codex-review-passed` or substitute gate + runtime smoke: build dev client with anchor tenant, observe gold; switch tenant slug to a test tenant with emerald, observe emerald, no flicker, no fallback to gold.

**Out of scope:** Brand colour theming for other surfaces (admin / shopkeeper — they have their own bars). Logo rendering (separate P2 polish). Footer parametrisation (separate P2 polish).

---

### Story 19.12 (T19.12): customer-mobile TypeScript is strict mode

**Class:** C — config flip + small fixup; no functional change; no new attack surface.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-strict-mob` · **Depends on:** none

**As a future developer working on customer-mobile**,
I want `tsconfig.json` to have `strict: true` so the type system catches `undefined`/`null` mishandling at compile time,
So that the same enterprise floor that customer-web enforces also applies to mobile, and I don't ship a runtime crash that strict mode would have caught.

**FRs implemented:** CLAUDE.md §Engineering rules — TypeScript `strict: true`
**NFRs verified:** Enterprise floor parity (web is already strict per audit §1; mobile must match per audit §2 critical gap #2)

**Modules + packages touched:**
- `apps/customer-mobile/tsconfig.json` (add `"strict": true` under compilerOptions)
- `apps/customer-mobile/app/(tabs)/browse.tsx:29` (fix `SearchParamValue` inference per audit §2)
- `apps/customer-mobile/app/...` (3–5 other expected fallout points; address as they appear from `pnpm typecheck`)
- `apps/customer-mobile/src/lib/...` (likely 1–2 fixups)

**ADRs governing:** none new
**Pattern rules honoured:** strict mode + no silent `any` (use proper narrowing); no `// @ts-ignore` to bypass — fix the type properly; no widening to satisfy strict (e.g. `as string` only when truly safe and commented)
**Complexity:** XS (2h — config flip + 3–5 trivial fixups)

**Acceptance Criteria:**

**Given** `tsconfig.json` has `"strict": true`
**When** `pnpm typecheck` runs in `apps/customer-mobile`
**Then** it returns 0 errors

**Given** any new `// @ts-ignore` or `as any` is added during fixup
**Then** the reviewer flags it for justification (acceptable only if narrowing is genuinely impossible AND a comment explains why)

**Given** CI runs
**Then** typecheck job passes for customer-mobile (it currently passes because strict is off; this story makes the bar harder, then makes it pass again)

**Tests required:** N/A (config + fixup; tests do not change)

**Definition of Done:** All AC + green CI + PR review notes any `as any` / `@ts-ignore` additions with justification + `.codex-review-passed` or substitute gate (substitute is fine; this is Class C). No runtime change; no runtime smoke required per CLAUDE.md Class C exemption.

**Out of scope:** Flipping strict on other apps (already on for web; shopkeeper out of E19 scope). Adding `noUncheckedIndexedAccess` or other extra-strict flags (defer).

---

### Story 19.13 (T19.13): customer-side audit log entries on wishlist / reviews / rate-lock / try-at-home

**Class:** B — adds audit trail to existing customer endpoints; new audit surface but not new attack surface.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-audit-cust` · **Depends on:** none (parallel with mobile-only work)

**As a compliance officer (or Alok in operator hat)**,
I want every customer state-changing action (wishlist add/remove, review submit, rate-lock book, try-at-home book) to write to `audit_log` with actor + tenant + subject context,
So that disputes ("I never booked that") and DPDPA audits can be answered from a single primary source.

**FRs implemented:** NFR-S9 closure (audit-log parity with shopkeeper-side, which already audit-logs)
**NFRs verified:** NFR-S9 (auth audit + state-change audit); DPDPA traceability

**Modules + packages touched:**
- `apps/api/src/modules/wishlist/wishlist.service.ts` (on add/remove, call `auditLog(this.pool, { action: 'WISHLIST_ADDED'|'WISHLIST_REMOVED', actor: customerId, subject_type: 'product', subject_id: productId, after: { phone_hash } })`)
- `apps/api/src/modules/reviews/reviews.service.ts` (on submit, audit with `REVIEW_SUBMITTED`)
- `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts` (on book + cancel, audit with `RATE_LOCK_BOOKED` / `RATE_LOCK_CANCELLED`)
- `apps/api/src/modules/customer/customer.service.ts` (try-at-home portion — on book + return, audit with `TRY_AT_HOME_BOOKED` / `TRY_AT_HOME_RETURNED`)
- `packages/audit/src/actions.ts` (add the 6 new AuditAction enum values if not already present)
- `apps/api/src/modules/wishlist/wishlist.service.spec.ts` (test that audit is called on success)
- `apps/api/src/modules/reviews/reviews.service.spec.ts` (same)
- (and the booking equivalents)

**ADRs governing:** ADR-0011 (compliance package hard-block gateway — audit is the trace surface)
**Pattern rules honoured:** `auditLog(this.pool, {...})` fire-and-forget per `feedback_audit_pattern_pool_not_tx.md` (NOT `audit.emit(tx, ...)` which is a non-existent API); no raw PII in audit payload (hash phone, never raw); tenant-scoped (`shop_id` auto-included via `auditLog` helper or explicit field)
**Complexity:** M (6h)

**Acceptance Criteria:**

**Given** a customer adds a product to wishlist
**When** the API call succeeds
**Then** a row appears in `audit_log` with `action='WISHLIST_ADDED'`, `actor='customer:<id>'`, `subject_type='product'`, `subject_id=<productId>`, `shop_id=<shopId>`, `after.phone_hash=<sha256>`

**Given** a customer submits a review
**Then** an audit row with `action='REVIEW_SUBMITTED'`, `subject_type='product'`, `subject_id=<productId>`

**Given** a customer books a rate-lock
**Then** an audit row with `action='RATE_LOCK_BOOKED'`, `subject_type='rate_lock_booking'`, `subject_id=<bookingId>`, `after.locked_rate_paise=<n>`

**Given** a customer books a try-at-home
**Then** an audit row with `action='TRY_AT_HOME_BOOKED'`, `subject_type='try_at_home_booking'`, `subject_id=<bookingId>`, `after.product_count=<n>`

**Given** the audit write fails (DB error)
**Then** the customer-facing API call STILL succeeds (audit is fire-and-forget per pattern) and the failure is logged to Sentry

**Given** an operator queries the audit log for a phone hash
**Then** they see the full timeline of that customer's state-changing actions in chronological order

**Given** CI runs
**Then** typecheck + lint + unit + integration + tenant-isolation pass; Semgrep clean

**Tests required:**
- Unit: each service spec asserts `auditLog` is called with correct shape on success
- Integration: end-to-end add wishlist → verify audit row exists in test DB with correct fields
- Tenant-isolation: customer of shop A's audit rows scoped to shop A only; shop B operator cannot see them

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: against a running API + Postgres, exercise each action, query `audit_log`, confirm 4 distinct action types land with correct shape.

**Out of scope:** Customer-facing "view my activity log" UI (defer). Audit log retention policy (defer; current default retention OK). Audit log export (defer).

---

### Story 19.14 (T19.14): orphaned customer-mobile routes are deleted or implemented

**Class:** C — small cleanup; either delete two route dirs or stub them to a "coming soon" screen so deep links don't 404.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-orphan-mob` · **Depends on:** none

**As a customer who taps a shared deep link**,
I want the link to either work or show a graceful message — NOT crash the app with a missing-route error,
So that I don't lose trust in the app the first time I try a deep link someone WhatsApped me.

**FRs implemented:** none directly (UX correctness on a known-broken surface)
**NFRs verified:** Enterprise floor — no orphan routes per code-truth audit

**Modules + packages touched:**
- `apps/customer-mobile/app/profile/addresses/` (decision: implement OR delete the directory)
- `apps/customer-mobile/app/profile/referral/` (same)
- If implementing: add minimal `index.tsx` per directory with a Hindi "जल्द ही" (coming soon) state + back navigation
- If deleting: remove the directories entirely

**ADRs governing:** none new
**Pattern rules honoured:** no orphan routes (a route directory must have a renderable `index.tsx` or not exist); Hindi-first if implementing the stub; back navigation always works
**Complexity:** XS (2h)

**Acceptance Criteria:**

**Given** the project decision is "delete both"
**When** a user navigates to `/profile/addresses` or `/profile/referral` via deep link
**Then** Expo Router shows its standard 404 (not a crash) — acceptable because no nav link to these routes exists

**Given** the project decision is "implement stubs"
**When** a user navigates to either route
**Then** they see a Hindi "जल्द ही" coming-soon screen with a back button
**And** the screen is reachable via deep link without crashing

**Given** CI runs
**Then** typecheck + lint pass; no orphan route dirs detectable via a script (optional: add a CI check that scans `app/` for directories without `index.tsx`)

**Tests required:**
- Optional: CI script that lists `app/` directories missing `index.tsx`
- If implementing stubs: snapshot test on the stub component

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate. Runtime smoke required only if implementing stubs (verify deep link renders the stub); deletion-only does not need smoke per Class C exemption.

**Out of scope:** Actually implementing addresses or referral as features (separate stories if/when the anchor signs and these features are scoped).

---

### Story 19.15 (T19.15): PostHog events fire from customer-web + customer-mobile

**Class:** B — analytics wiring; no compliance surface; new write paths to PostHog SaaS.
**Wave:** 2 (P1) · **Worktree:** `C:/gs19-posthog-cust` · **Depends on:** all other E19 stories merged (want PostHog to fire from final HEAD, not from drift mid-epic)

**As Alok (operator / product owner)**,
I want PostHog events to fire from customer-web and customer-mobile for the key customer actions (page_view, wishlist_add, review_submit, booking_create),
So that I can answer "what are customers actually doing" without instrumenting after-the-fact when usage starts.

**FRs implemented:** none directly (operational visibility); parity with API PostHog usage on billing/custom-orders/loyalty per audit §3
**NFRs verified:** Enterprise floor — PostHog event tracking; data-residency-compliant deployment per CLAUDE.md India vendor stack

**Modules + packages touched:**
- `apps/customer-web/package.json` (add `posthog-js`)
- `apps/customer-web/lib/analytics.ts` (new — init PostHog with India-residency host, expose `track(event, props)`)
- `apps/customer-web/app/layout.tsx` (PostHog provider; auto page-view tracking on route change)
- `apps/customer-web/components/products/WishlistButton.tsx` (fire `wishlist_add` / `wishlist_remove`)
- `apps/customer-web/components/profile/...` (fire booking events where applicable)
- `apps/customer-mobile/package.json` (add `posthog-react-native`)
- `apps/customer-mobile/src/lib/analytics.ts` (new)
- `apps/customer-mobile/app/_layout.tsx` (init PostHog provider)
- `apps/customer-mobile/app/(tabs)/index.tsx` and other screens (fire page-view + key events)
- `.github/workflows/ship.yml` (validate `POSTHOG_API_KEY` env var present in build jobs)

**ADRs governing:** none new; CLAUDE.md India vendor stack (PostHog data-residency-compliant)
**Pattern rules honoured:** no PII in event properties (phone is hashed if needed for cohort analysis, but prefer NOT to send phone at all); tenant slug always tagged; opt-out respected if a future consent toggle lands; events use snake_case names matching API convention
**Complexity:** M (6h)

**Acceptance Criteria:**

**Given** a customer visits the customer-web homepage
**When** the page renders
**Then** PostHog receives a `page_view` event with `{ path: '/', tenant: <slug> }` and no PII

**Given** a customer adds an item to wishlist on customer-web
**Then** PostHog receives `wishlist_add` with `{ product_id, tenant, phone_hash }`

**Given** a customer submits a review on customer-mobile
**Then** PostHog receives `review_submit` with `{ product_id, rating, tenant, phone_hash }`

**Given** a customer books a rate-lock or try-at-home on either app
**Then** PostHog receives `booking_create` with `{ booking_type, tenant, phone_hash }` (booking_type='rate_lock' or 'try_at_home')

**Given** a customer is on a slow / offline network
**Then** PostHog's SDK queues events and retries (no event loss; no app stall)

**Given** PostHog API key is missing in CI
**Then** the build job validates presence and fails fast if missing in production builds (dev/test builds may run with PostHog disabled)

**Given** CI runs
**Then** typecheck + lint + Vitest + Lighthouse all pass; Sentry events do NOT include PostHog noise (the two SDKs are independent)

**Tests required:**
- Unit: `track()` wrapper scrubs PII (refuses to send phone, name, address; allows phone_hash); tenant tag always included
- Integration: synthetic flow exercises each event type; mocked PostHog transport receives the right payloads
- CI gate: env var presence check

**Definition of Done:** All AC + green CI + `.codex-review-passed` or substitute gate + runtime smoke: deploy both apps to preview, exercise each event, confirm in PostHog dashboard within 5 minutes.

**Out of scope:** Funnel analysis dashboards (defer; build once events flow). Cohort definitions (defer). PostHog feature flags (separate concern; CLAUDE.md says GrowthBook for feature flags, not PostHog).

---

## Parallelisation Strategy (per CLAUDE.md `feedback_parallel_session_worktrees.md`)

**Wave 1 — P0 (paying-tenant deploy unblockers):**
- 19.1 + 19.2 + 19.3 + 19.4 + 19.5 — **all five parallel** in separate worktrees. None share files. Merge order arbitrary; recommended order: smallest first (19.3, 19.4 are 4h each; 19.1, 19.2 are 4h each; 19.5 is 6h).
- 19.6 — **serial after all of the above merge.** Single session, runs Codex + /security-review in parallel on merged HEAD.

**Wave 2 — P1 (production claim defensible):**
- 19.7 (DPDPA) — **serial alone in a fresh session** per `feedback_fresh_session_prompt_ceremony.md` Class A auth/RLS context-quarantine rule. Do NOT parallelise with anything that touches customer.service.ts or auth.
- 19.8 (web wishlist→backend) + 19.10 (web FilterPanel) — **parallel.** Both customer-web; different files (`app/wishlist/page.tsx` + `WishlistButton.tsx` vs `FilterPanel.tsx`); no merge contention.
- 19.9 (web /profile timeline) — **serial after 19.8** (both touch web auth/profile surface; serialise to avoid merge contention).
- 19.11 (mobile colours) + 19.12 (mobile strict TS) + 19.14 (mobile orphan routes) — **parallel.** All customer-mobile; different files; no overlap.
- 19.13 (API audit log) — **parallel with any mobile-only work.** Touches API only, not customer apps.
- 19.15 (PostHog) — **last.** Spans both customer apps and benefits from a stable HEAD after every other story merges.

**Merge contention guards:**
- No two stories touch `customer.service.ts` simultaneously (19.7 owns it during execution).
- No two stories touch `wishlist.service.ts` simultaneously (19.13 owns it during execution; 19.8 only touches client-side wiring, no overlap).
- No two stories touch `.github/workflows/ship.yml` simultaneously (19.1, 19.2, 19.4, 19.13 all might; serialise their CI changes via brief PR ordering OR consolidate the CI changes into a single follow-up commit per wave).

**Migration sequencing:**
- 19.7 owns migration `0075_customer_deletion.sql`. If another epic (E20+) ships a migration before 19.7 merges, 19.7 rebases to the next available number.
- No other E19 story adds a migration.

---

## Epic-level Definition of Done

- All 15 stories' DoD met individually
- `.codex-review-passed` and `.security-review-passed` markers both fresh on final epic-merge HEAD
- A production deploy of API (Cloud Run) + customer-web (App Hosting) + customer-mobile (EAS) is reachable and installable
- All seven verification steps from the parent_audit §Section 7 pass
- Memory updated with a single new entry: `project_epic_e19_complete.md` summarising the merge, with pointers to the 15 story commits

---

## Out of scope for E19 (explicit non-goals)

- **Multi-tenant scale-out** — automated per-tenant App Hosting backend, per-tenant EAS app provisioning, per-tenant Cloud Run service. These are productisation, handled by a future epic (E20+).
- **Pentest** — deferred per CLAUDE.md startup-economics-first graduation triggers; first paying tenant signs first.
- **Performance hardening** — Redis catalog cache, DB index coverage audit, CDN tuning. Defer to a future story when traffic surfaces a measurable problem.
- **English toggle on customer apps** — CLAUDE.md "Hindi-first with English toggle" deferred; tenant + customer base is Hindi-first for the anchor and likely the next 2–3 tenants. Schedule when a tenant explicitly requests English UI.
- **Real product imagery pipeline** — depends on anchor jeweller delivering photos; the plumbing exists (next/image, srcset, AVIF/WebP) and Story 17.1 already shipped the image-upload backend. E19 does not re-touch this.
- **Customer-mobile micro-interactions / animations** — Reanimated is in deps but unused; defer to a polish epic when a paying tenant says "make it feel premium."
- **Sitemap / robots.txt / additional SEO schemas** — defer per audit §1 P2 list; not ship-blocking.
- **JewelryStore JSON-LD on homepage, BreadcrumbList on collections** — defer per audit §1 P2 list.
- **Logo rendering in TenantBrandHeader** — defer per audit §2 polish list.
- **Footer parametrisation on customer-mobile** — defer per audit §2 polish list.
- **Maestro E2E for customer-mobile + Playwright for customer-web** — defer per audit §3 P2 list; manual smoke + Lighthouse + tenant-isolation tests are the current safety net.
