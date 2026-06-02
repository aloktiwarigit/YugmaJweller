# Virtual Try-On — Follow-Up Items (Plan 1/2 polish)

> Surfaced by the independent code review of `feat/try-on-plan3` (2026-06-01).
> These findings are in **Plan 1/2 code already merged to main** — NOT introduced
> by Plan 3 — so they were deliberately left out of the Plan 3 PR to keep its
> blast radius scoped. Address as a small standalone branch when convenient.
> None are blocking; severities are review-assigned.

## 1. Cutout worker silently no-ops when the asset row is missing — IMPORTANT
- **File:** `apps/api/src/modules/inventory/try-on-asset.processor.ts` (success-path `UPDATE` ~L38–44; failure-path `UPDATE` ~L49–52)
- **Issue:** Neither `UPDATE product_try_on_assets ... WHERE product_id = $n` uses `RETURNING`/`rowCount`. If the row is deleted between job enqueue and processing, both updates affect zero rows; BullMQ records the job as succeeded, and the cutout PNG is uploaded to storage with no DB row pointing at it (orphan blob).
- **Fix:** Add `RETURNING id` (or check `r.rowCount === 0`) on the success UPDATE and throw a retriable error when no row matched. Apply the same guard to the failure-path UPDATE so a missing row doesn't mask a real failure.

## 2. `getBgRemovalAdapter()` called inline instead of DI-injected — MINOR (convention)
- **File:** `apps/api/src/modules/inventory/try-on-asset.processor.ts` (~L24, inside `handle()`)
- **Issue:** The bg-removal adapter is summoned via the env factory on every job rather than injected. It reads `process.env['BG_REMOVAL_ADAPTER']` per-invocation (could switch adapters between retries) and deviates from the adapter-injection convention already used in the same file (`@Inject(STORAGE_PORT)`).
- **Fix:** Register a `BG_REMOVAL_PORT` provider in `InventoryModule` (factory → `getBgRemovalAdapter()` once at startup) and `@Inject` it in the processor constructor.

## 3. React 18 strict-mode double-invoke can acquire two camera streams — MINOR (dev-only)
- **File:** `apps/customer-web/components/try-on/TryOnModal.tsx` (camera-request effect ~L55–57; track-stop cleanup ~L36–38)
- **Issue:** The track-stop cleanup closes `stream` from React state, not from the effect's local scope. In dev strict-mode the effect runs twice; the first cleanup can fire before `setStream` commits, leaking the first acquired `MediaStream`. Production (single invoke) is unaffected.
- **Fix:** Gate one effect on `modalState === 'requesting'`, capture the stream in a local variable, `setStream(s)`, and stop `localStream` in that same effect's cleanup. Remove the separate state-based cleanup + mount-only effect.

## 4. `drawApproxBadge` duplicated across renderers — MINOR (maintainability)
- **Files:** `apps/customer-web/components/try-on/face-renderer.ts` (~L148–157) and `hand-renderer.ts` (~L148–156)
- **Issue:** The two implementations are identical; a later fix to one will silently diverge from the other.
- **Fix:** Extract to a shared `apps/customer-web/components/try-on/renderer-utils.ts` and import from both.

## 5. Unstable `detect` reference restarts the rAF loop on every re-render — MINOR (perf)
- **Files:** `apps/customer-web/components/try-on/useFaceDetector.ts` (~L52) and `useHandDetector.ts` (~L48); consumed in `TryOnCanvas.tsx` rAF effect deps (~L102)
- **Issue:** Each hook returns a fresh `detect` function per render (not memoized). `TryOnCanvas` lists `detectFace`/`detectHand` in the rAF `useEffect` deps, so any parent re-render (e.g. the `loading → active` transition) tears down and restarts the running detection loop mid-stream.
- **Fix:** Wrap `detect` in `useCallback(..., [])` inside each detector hook — `detectorRef` is a stable `useRef`, so the callback can be stable.

---

### Reviewed and dismissed (not real issues)
- **Drizzle single-column FK vs composite migration FK** on `product_try_on_assets` — the project uses hand-written raw SQL migrations (per CLAUDE.md), not drizzle-kit generation. The Drizzle schema is only for typed query-building and never regenerates the migration's composite `(shop_id, product_id)` FK, so there is no drift risk.
