import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'fast-glob';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageEntry {
  name: string;
  path: string;
  scripts: string[];
}

interface EndpointEntry {
  method: string;
  path: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function getPackage(root: string, relPath: string): PackageEntry | null {
  const full = join(root, relPath, 'package.json');
  if (!existsSync(full)) return null;
  const json = JSON.parse(readFileSync(full, 'utf8')) as { name?: string; scripts?: Record<string, string> };
  return {
    name: json.name ?? relPath,
    path: relPath,
    scripts: Object.keys(json.scripts ?? {}).sort(),
  };
}

function getWorkspacePackages(root: string): PackageEntry[] {
  const entries: PackageEntry[] = [];
  for (const rel of ['apps/api', 'apps/customer-mobile', 'apps/customer-web', 'apps/shopkeeper']) {
    const entry = getPackage(root, rel);
    if (entry) entries.push(entry);
  }
  const dirs = globSync(['packages/*/package.json', 'packages/*/*/package.json', 'ops/eslint-rules/*/package.json'], {
    cwd: root,
    ignore: ['**/node_modules/**'],
  }).sort();
  for (const pkg of dirs) {
    const rel = normalizePath(dirname(pkg));
    const entry = getPackage(root, rel);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function parseStringArg(raw: string): string {
  const m = raw.match(/['"`]([^'"`]*)['"`]/);
  return m ? m[1] : '';
}

function joinRoute(base: string, sub: string): string {
  const cleanedBase = base.startsWith('/') ? base : `/${base}`;
  const trimmedBase = cleanedBase.replace(/\/+$/, '');
  const trimmedSub = sub.replace(/^\/+/, '');
  if (!trimmedSub) return trimmedBase || '/';
  return `${trimmedBase}/${trimmedSub}`;
}

function getApiControllers(root: string): Array<{ module: string; file: string; basePath: string; endpoints: EndpointEntry[] }> {
  const files = globSync('apps/api/src/modules/**/*.controller.ts', { cwd: root }).sort();
  return files.map((file) => {
    const content = readFileSync(join(root, file), 'utf8');
    const baseMatch = content.match(/@Controller\(([^)]*)\)/);
    const basePath = baseMatch ? parseStringArg(baseMatch[1]) : '';
    const endpoints: EndpointEntry[] = [];
    for (const m of content.matchAll(/@(Get|Post|Patch|Delete)\(([^)]*)\)/g)) {
      const method = m[1].toUpperCase();
      const subPath = parseStringArg(m[2]);
      endpoints.push({ method, path: joinRoute(basePath, subPath) });
    }
    const moduleMatch = file.match(/apps\/api\/src\/modules\/([^/]+)/);
    return {
      module: moduleMatch ? moduleMatch[1] : 'unknown',
      file: normalizePath(file),
      basePath: basePath.startsWith('/') ? basePath : `/${basePath}`,
      endpoints,
    };
  });
}

function routeFromExpoFile(file: string, appRoot: string): string {
  let rel = file.slice(appRoot.length).replace(/\\/g, '/');
  rel = rel.replace(/\.tsx$/, '');
  rel = rel.replace(/\/index$/, '');
  rel = rel.replace(/\/_layout$/, '/_layout');
  rel = rel.replace(/\([^/]+\)\//g, '');
  if (!rel.startsWith('/')) rel = `/${rel}`;
  return rel === '' ? '/' : rel;
}

function routeFromNextFile(file: string): string {
  let rel = file.replace(/^apps\/customer-web\/app/, '').replace(/\\/g, '/');
  rel = rel.replace(/\/page\.tsx$/, '');
  if (!rel.startsWith('/')) rel = `/${rel}`;
  return rel === '' ? '/' : rel;
}

function getUiRoutes(root: string): Record<string, Array<{ file: string; route: string }>> {
  const shopkeeper = globSync('apps/shopkeeper/app/**/*.tsx', { cwd: root }).sort()
    .map((file) => ({ file: normalizePath(file), route: routeFromExpoFile(file, 'apps/shopkeeper/app') }));
  const customerMobile = globSync('apps/customer-mobile/app/**/*.tsx', { cwd: root }).sort()
    .map((file) => ({ file: normalizePath(file), route: routeFromExpoFile(file, 'apps/customer-mobile/app') }));
  const customerWeb = globSync('apps/customer-web/app/**/page.tsx', { cwd: root }).sort()
    .map((file) => ({ file: normalizePath(file), route: routeFromNextFile(file) }));
  return { shopkeeper, customerMobile, customerWeb };
}

function getMigrations(root: string): Record<string, unknown> {
  const files = globSync('packages/db/src/migrations/*.sql', { cwd: root }).sort();
  const latest = files.length ? files[files.length - 1] : null;
  return {
    count: files.length,
    current: latest ? latest.split('/').pop()?.split('_')[0] : null,
    latest: latest ? normalizePath(latest) : null,
    recent: files.slice(-10).map(normalizePath),
  };
}

function getCiJobs(root: string): string[] {
  const workflow = join(root, '.github/workflows/ship.yml');
  if (!existsSync(workflow)) return [];
  const parsed = parseYaml(readFileSync(workflow, 'utf8')) as { jobs?: Record<string, unknown> };
  return Object.keys(parsed.jobs ?? {}).sort();
}

export async function generate(root: string): Promise<Record<string, unknown>> {
  const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  const packages = getWorkspacePackages(root);
  return {
    generated: new Date().toISOString(),
    apps: packages.filter((p) => p.path.startsWith('apps/')),
    packages: packages.filter((p) => p.path.startsWith('packages/') || p.path.startsWith('ops/')),
    apiControllers: getApiControllers(root),
    uiRoutes: getUiRoutes(root),
    migrations: getMigrations(root),
    rootScripts: rootPackage.scripts ?? {},
    ciJobs: getCiJobs(root),
  };
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/implementation-map.json');
  generate(repoRoot).then((result) => {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log('implementation-map.json written');
  }).catch((err) => { console.error(err); process.exit(1); });
}
