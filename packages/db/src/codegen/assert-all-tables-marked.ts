import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface Violation { file: string; line: number; message: string; }

export function findRawPgTableUsages(source: string, file: string): Violation[] {
  if (file.includes(`${sep}_helpers${sep}`) || file.includes('/_helpers/')) return [];
  const out: Violation[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/\bpgTable\s*\(/.test(code)) {
      out.push({
        file,
        line: i + 1,
        message: `raw pgTable() forbidden — use tenantScopedTable() or platformGlobalTable() from _helpers/`,
      });
    }
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

export function assertAllTablesMarked(schemaDir: string): Violation[] {
  const files = walk(schemaDir);
  const violations: Violation[] = [];
  for (const f of files) {
    violations.push(...findRawPgTableUsages(readFileSync(f, 'utf8'), relative(process.cwd(), f)));
  }
  return violations;
}

// Entry-point guard: runs when invoked directly via `tsx src/codegen/assert-all-tables-marked.ts`
// Uses argv[1] path check because import.meta.url may be undefined under esbuild/tsx transforms.
const _argv1 = process.argv[1] ?? '';
const _isMain =
  _argv1.endsWith('assert-all-tables-marked.ts') ||
  _argv1.endsWith('assert-all-tables-marked.js');
if (_isMain) {
  // When invoked via `pnpm run db:assert-marked` from packages/db/, cwd is packages/db.
  // When invoked from the monorepo root (e.g., in CI), cwd is the repo root.
  // Resolve schema dir relative to this file so it works from any cwd.
  const schemaDir = join(
    _argv1.replace(/\\/g, '/').replace(/\/src\/codegen\/assert-all-tables-marked\.(ts|js)$/, ''),
    'src/schema',
  );
  const violations = assertAllTablesMarked(schemaDir);
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line} — ${v.message}`);
    process.exit(1);
  }
  console.log('OK — all tables marked via helpers.');
}
