import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getApiModules(root: string): string[] {
  const dir = join(root, 'apps/api/src/modules');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => statSync(join(dir, f)).isDirectory()).sort();
}

function getCurrentMigration(root: string): string {
  const dir = join(root, 'packages/db/src/migrations');
  if (!existsSync(dir)) return '0000';
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  return files.length ? files[files.length - 1].split('_')[0] : '0000';
}

function getPackages(root: string): Array<{ name: string; path: string }> {
  const pkgsDir = join(root, 'packages');
  const result: Array<{ name: string; path: string }> = [];
  if (!existsSync(pkgsDir)) return result;
  for (const dir of readdirSync(pkgsDir)) {
    const full = join(pkgsDir, dir);
    if (!statSync(full).isDirectory()) continue;
    const pkgJson = join(full, 'package.json');
    if (existsSync(pkgJson)) {
      const p = JSON.parse(readFileSync(pkgJson, 'utf8')) as { name: string };
      result.push({ name: p.name, path: `packages/${dir}` });
    } else {
      for (const sub of readdirSync(full)) {
        const subFull = join(full, sub);
        if (!statSync(subFull).isDirectory()) continue;
        const subPkg = join(subFull, 'package.json');
        if (existsSync(subPkg)) {
          const p = JSON.parse(readFileSync(subPkg, 'utf8')) as { name: string };
          result.push({ name: p.name, path: `packages/${dir}/${sub}` });
        }
      }
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function extractInvariants(claudeMd: string): string[] {
  const invariants: string[] = [];
  const sectionMatch = claudeMd.match(/## Non-negotiable engineering rules([\s\S]*?)^##\s/m);
  if (sectionMatch) {
    const bullets = sectionMatch[1].match(/^- \*\*.+$/gm) ?? [];
    for (const b of bullets) {
      const clean = b.replace(/^- /, '').replace(/\*\*/g, '').trim();
      if (clean.length > 10) invariants.push(clean);
    }
  }
  const hardcoded = [
    'auditLog(pool, {action, subjectType, subjectId, actorUserId}) from @goldsmith/audit — never audit.emit(tx, ...)',
    'Use import (not import type) for NestJS @Injectable constructor params',
    'No Goldsmith platform brand on any customer-facing surface',
    'All new @Injectable constructors need explicit @Inject(Token) — tsx/esbuild drops paramtypes',
  ];
  for (const h of hardcoded) {
    if (!invariants.some(i => i.startsWith(h.slice(0, 20)))) invariants.push(h);
  }
  return invariants;
}

export async function generate(root: string): Promise<Record<string, unknown>> {
  const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  const appsDir = join(root, 'apps');
  const apps = readdirSync(appsDir)
    .filter(f => statSync(join(appsDir, f)).isDirectory())
    .map(name => ({ name, path: `apps/${name}` }));

  return {
    generated: new Date().toISOString(),
    repo: 'Goldsmith',
    description: 'Multi-tenant white-label jewellery platform for local Indian jewellers',
    stack: {
      api: 'NestJS (TypeScript) + PostgreSQL 15 + Drizzle + Redis + BullMQ',
      mobile: 'React Native (Expo SDK 50) + NativeWind',
      web: 'Next.js 14 (App Router) + Tailwind CSS + shadcn/ui',
      auth: 'Firebase Auth (phone OTP)',
      storage: 'Azure Blob Storage + ImageKit CDN',
      search: 'Meilisearch',
      monorepo: 'Turborepo + pnpm',
    },
    apps,
    packages: getPackages(root),
    apiModules: getApiModules(root),
    commands: {
      dev: 'pnpm dev',
      typecheck: 'pnpm typecheck',
      lint: 'pnpm lint',
      'test:unit': 'pnpm test:unit',
      'test:integration': 'pnpm test:integration',
      'test:tenant-isolation': 'pnpm test:tenant-isolation',
      'test:ci': 'pnpm test:ci',
      'db:reset': 'pnpm db:reset',
      'docs:context': 'pnpm docs:context',
      'docs:validate': 'pnpm docs:validate',
    },
    invariants: extractInvariants(claudeMd),
    ceremonyClasses: {
      A: ['auth', 'money', 'RLS', 'compliance', 'platform-admin', 'migrations touching RLS/roles/SECURITY DEFINER', 'webhook handlers', 'encryption'],
      B: ['products', 'customers', 'dashboards', 'notification prefs', 'settings', 'search', 'reports'],
      C: ['copy tweaks', 'colors/spacing', 'config-toggles', 'doc-only', 'refactors <50 LOC', 'dep bumps'],
    },
    migrations: {
      current: getCurrentMigration(root),
      reserved: '0060-0085',
      pattern: 'packages/db/src/migrations/{seq}_{slug}.sql',
    },
  };
}

// CLI entry point — only runs when this file is the direct entrypoint
if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/project.context.json');
  generate(repoRoot).then(result => {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log('✓ project.context.json written');
  }).catch(err => { console.error(err); process.exit(1); });
}
