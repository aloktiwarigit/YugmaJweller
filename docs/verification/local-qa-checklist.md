# Local QA Checklist

Updated 2026-05-06 for Windows verification blockers.

## Preflight

Run:

```powershell
.\scripts\qa\local-preflight.ps1
```

Use `-Strict` when the preflight should fail the shell on missing tools. Use `-CleanupTestcontainers` only after confirming the listed `org.testcontainers=true` containers are stale.

Current local observations:

- Node is `v24.13.1`, while `package.json` requires `>=20.11.0 <21`.
- Docker Desktop is reachable.
- `adb` is not on PATH.
- Native Semgrep is blocked by Windows Application Control when it launches `pysemgrep`.
- Generated package artifacts exist under `packages/*/(src|test)`.

## Lint

Run:

```powershell
pnpm lint
```

Generated `.js`, `.d.ts`, and `.js.map` package artifacts are covered by the current root ESLint ignore patterns. If lint starts reporting generated files again, run the preflight artifact section before changing source.

Observed 2026-05-06 result: full `pnpm lint` moved past generated package artifacts and failed on existing customer-mobile source errors in `apps/customer-mobile/src/hooks/useCustomerTimeline.ts` for missing explicit return types. That is runtime source, not a QA asset.

## Testcontainers

Use serialized local runners on Windows to avoid many parallel Postgres container startups:

```powershell
.\scripts\qa\run-testcontainers-gate.ps1 -Scope TenantIsolation
.\scripts\qa\run-testcontainers-gate.ps1 -Scope IntegrationSmoke
.\scripts\qa\run-testcontainers-gate.ps1 -Scope ApiIntegration
.\scripts\qa\run-testcontainers-gate.ps1 -Scope IntegrationFull
```

The runner passes `--maxWorkers=1 --no-file-parallelism` to Vitest and sets `TESTCONTAINERS_RYUK_DISABLED=false`.

Before long integration runs:

```powershell
docker ps --filter label=org.testcontainers=true
```

Observed 2026-05-06 result: 20 stale `postgres:15.6` containers were already running with `org.testcontainers=true`. A direct scoped tenant-isolation run passed in 37.84s. The serialized runner also passed in 49.05s, and the final Testcontainers count returned to 20 after Ryuk cleanup.

## Semgrep

Native command:

```powershell
pnpm semgrep
```

Docker fallback:

```powershell
.\scripts\qa\run-semgrep.ps1 -Docker
```

Observed 2026-05-06 native failure:

```text
executing pysemgrep failed: run ["pysemgrep" "--version"]: An Application Control policy has blocked this file.
```

## Android Smoke

Required local tools:

```powershell
adb devices
adb reverse --list
```

For the shopkeeper app, follow the short-root Windows path from `CLAUDE.md`: build and run from `C:\gs`, start Metro from `C:\gs\apps\shopkeeper`, then re-arm the reverse tunnel after every Metro restart:

```powershell
adb -s <DEVICE_SERIAL> reverse tcp:8081 tcp:8081
adb reverse --list
```

Current blocker: `adb` is not on PATH in this shell.

## Browser Smoke

Customer web:

```powershell
pnpm --filter @goldsmith/customer-web dev
```

Then open:

- `http://localhost:3000`
- `http://localhost:3000/products`
- `http://localhost:3000/wishlist`
- `http://localhost:3000/try-at-home`
- `http://localhost:3000/admin/login`

There is no automated browser smoke command in the repo yet; this path is manual until Playwright or an equivalent browser runner is added.
