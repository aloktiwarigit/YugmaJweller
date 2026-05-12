# Agent Start Here

Read this first in future sessions. It exists so agents do not re-scan BMAD research, old reviews, memory, or git history just to understand the project.

## Read Order

1. `CLAUDE.md` - invariants and delivery model.
2. `docs/agent-context/project.context.json` - stack, commands, source-of-truth rules, invariants.
3. `docs/agent-context/current-state.json` - current code-backed status by functional area.
4. `docs/agent-context/implementation-map.json` - apps, packages, API endpoints, UI routes, migrations, CI jobs.
5. `docs/agent-context/task-routing.json` - task class to source files and verification commands.
6. `docs/current-implementation-status.md` - human-readable status and gaps.

Only then open requirement docs for the specific feature being changed.

## Requirement Sources

Use these only when a task needs exact FR/NFR wording:

- `_bmad-output/planning-artifacts/prd.md` - FR1-FR126 and NFRs.
- `docs/prd-addendum-customer-storefront.md` - FR127-FR140.
- `_bmad-output/planning-artifacts/architecture.md` and `docs/adr/*.md` - architecture rationale.
- `_bmad-output/planning-artifacts/ux-design-specification.md` - historical UX direction; current code and `CLAUDE.md` override it where they differ.

## Do Not Read By Default

- `docs/reviews/**`
- `docs/superpowers/plans/**`
- `_bmad-output/planning-artifacts/research/**`
- `_bmad-output/**/design-directions*.html`
- memory files except the `MEMORY.md` index when a task explicitly depends on prior-session decisions
- git history for completion proof

## Completion Proof Rule

Code is the truth. Completion claims require current code, migrations, reachable app routes or API routes, tests, and CI gates. BMAD docs, plans, reviews, memory, and git logs are requirements or history only.

## Regenerate Context

After changing code structure, routes, docs, ADRs, or status:

```bash
pnpm docs:context
pnpm docs:validate
```

`docs:context` regenerates the machine-readable layer. `docs:validate` checks drift and task-routing paths.
