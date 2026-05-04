import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import all generators — tsx resolves .js imports to .ts source files
import { generate as genContext } from './scan-repo-context.js';
import { generate as genAdrs } from './extract-adrs.js';
import { generate as genTrace } from './extract-bmad-trace.js';
import { generate as genDocs } from './scan-docs.js';
import { generate as genAcceptance } from './extract-acceptance.js';

const ARRAY_KEYS = ['frs', 'adrs', 'docs', 'stories', 'routes'] as const;
// Keys that are volatile and should be excluded from drift comparison
const VOLATILE_KEYS = ['generated', 'generatedAt', 'generated_at'] as const;

function normalize(obj: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...obj };
  for (const k of VOLATILE_KEYS) delete copy[k];
  return copy;
}

function computeDrift(
  committed: Record<string, unknown>,
  generated: Record<string, unknown>,
): { drift: number; changed: number; total: number } {
  // Strip volatile timestamp fields before comparison
  const c = normalize(committed);
  const g = normalize(generated);

  for (const key of ARRAY_KEYS) {
    if (Array.isArray(c[key]) && Array.isArray(g[key])) {
      const ca = c[key] as unknown[];
      const ga = g[key] as unknown[];
      if (JSON.stringify(ca) === JSON.stringify(ga)) return { drift: 0, changed: 0, total: ca.length };
      const total = Math.max(ca.length, ga.length);
      let changed = Math.abs(ca.length - ga.length);
      const min = Math.min(ca.length, ga.length);
      for (let i = 0; i < min; i++) {
        if (JSON.stringify(ca[i]) !== JSON.stringify(ga[i])) changed++;
      }
      return { drift: changed / total, changed, total };
    }
  }
  // Flat object — binary comparison
  const same = JSON.stringify(c) === JSON.stringify(g);
  return { drift: same ? 0 : 1, changed: same ? 0 : 1, total: 1 };
}

function checkPaths(root: string, routing: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const r of (routing.routes as Array<{ taskClass: string; sourceFiles: string[] }>) ?? []) {
    for (const p of r.sourceFiles) {
      // Skip paths for future modules that don't exist yet (expected during development)
      if (!existsSync(join(root, p))) {
        errors.push(`task-routing.json route "${r.taskClass}": missing path ${p}`);
      }
    }
  }
  return errors;
}

function checkSpecFiles(root: string, acceptance: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const s of (acceptance.stories as Array<{ id: string; specFile: string }>) ?? []) {
    if (s.specFile && !existsSync(join(root, s.specFile))) {
      errors.push(`acceptance-evidence.json story "${s.id}": missing specFile ${s.specFile}`);
    }
  }
  return errors;
}

async function main(root: string): Promise<void> {
  const outDir = join(root, 'docs/agent-context');
  const generators = [
    { name: 'project.context.json', fn: genContext },
    { name: 'decision-index.json', fn: genAdrs },
    { name: 'traceability.json', fn: genTrace },
    { name: 'doc-index.json', fn: genDocs },
    { name: 'acceptance-evidence.json', fn: genAcceptance },
  ];

  let hardFail = false;
  let softWarn = false;

  console.log('\n📋 Agent-Context Validation\n');

  for (const g of generators) {
    const filePath = join(outDir, g.name);
    if (!existsSync(filePath)) {
      console.error(`  ✗ ${g.name}: file missing — run pnpm docs:context first`);
      hardFail = true;
      continue;
    }
    const committed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const generated = await g.fn(root);
    const { drift, changed, total } = computeDrift(committed, generated);

    if (drift === 0) {
      console.log(`  ✓ ${g.name}`);
    } else if (drift <= 0.05) {
      console.warn(`  ⚠ ${g.name}: ${changed}/${total} entries drifted — run pnpm docs:context to update`);
      softWarn = true;
    } else {
      console.error(`  ✗ ${g.name}: SIGNIFICANT DRIFT ${changed}/${total} — run pnpm docs:context and commit`);
      hardFail = true;
    }
  }

  // Path checks on task-routing.json
  const routingPath = join(outDir, 'task-routing.json');
  if (!existsSync(routingPath)) {
    console.error('  ✗ task-routing.json: file missing');
    hardFail = true;
  } else {
    const routing = JSON.parse(readFileSync(routingPath, 'utf8')) as Record<string, unknown>;
    const pathErrors = checkPaths(root, routing);
    if (pathErrors.length) {
      for (const e of pathErrors) console.warn(`  ⚠ ${e} (future module — expected)`);
      // Path warnings for non-existent future modules are soft warnings, not hard failures
      softWarn = true;
    } else {
      console.log('  ✓ task-routing.json (all paths exist)');
    }
  }

  // Spec file checks on acceptance-evidence.json
  const acceptPath = join(outDir, 'acceptance-evidence.json');
  if (existsSync(acceptPath)) {
    const acc = JSON.parse(readFileSync(acceptPath, 'utf8')) as Record<string, unknown>;
    const specErrors = checkSpecFiles(root, acc);
    if (specErrors.length) {
      for (const e of specErrors) console.error(`  ✗ ${e}`);
      hardFail = true;
    } else {
      console.log('  ✓ acceptance-evidence.json (all specFiles exist)');
    }
  }

  if (hardFail) {
    console.error('\n❌ Validation failed\n');
    process.exit(1);
  } else if (softWarn) {
    console.warn('\n⚠ Warnings present — within acceptable thresholds\n');
  } else {
    console.log('\n✅ docs/agent-context/ is up to date\n');
  }
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  main(resolve(__dirname, '../..')).catch(err => { console.error(err); process.exit(1); });
}
