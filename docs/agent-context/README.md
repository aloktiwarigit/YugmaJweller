# Agent Context Layer

This directory is the low-token machine-readable project context for future sessions.

## Default Read Set

- `project.context.json` - stack, commands, source-of-truth rules, invariants, read order.
- `current-state.json` - current implementation status by area.
- `implementation-map.json` - apps, packages, API controllers/endpoints, UI routes, migrations, CI jobs.
- `task-routing.json` - task class to files and verification commands.

## Task-Specific Files

- `decision-index.json` - compact ADR lookup.
- `doc-index.json` - searchable long-doc inventory with read/avoid guidance.
- `traceability.json` - FR skeleton and explicit gap seeds. It is useful for requirement lookup, not complete status proof.
- `acceptance-evidence.json` - story/spec/test evidence where specs exist.
- `traceability-seed.json` - hand-authored overrides used by the traceability generator.

## Maintenance

Run these after code structure, docs, routes, ADRs, or status change:

```bash
pnpm docs:context
pnpm docs:validate
```

Do not hand-edit generated JSON files except `task-routing.json` and `traceability-seed.json`.
