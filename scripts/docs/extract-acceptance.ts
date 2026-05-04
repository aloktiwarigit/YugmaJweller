import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { globSync } from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StoryEntry {
  id: string;
  title: string;
  class: string;
  status: 'complete' | 'partial' | 'planned';
  frs: string[];
  specFile: string;
  testFiles: string[];
  ciJobs: string[];
  smokeTest: string;
  evidenceGaps: string[];
}

interface SpecFm {
  title?: string;
  implements?: string[];
  ceremonyClass?: string;
}

function storyId(filename: string): string | null {
  const m = filename.match(/story-([\d.]+)-/);
  return m ? m[1] : null;
}

function parseFm(content: string): SpecFm {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try { return parseYaml(m[1]) as SpecFm; } catch { return {}; }
}

const MODULE_HINTS: Record<string, string> = {
  '1': 'auth', '2': 'settings', '3': 'inventory', '4': 'pricing',
  '5': 'billing', '6': 'crm', '7': 'catalog', '8': 'loyalty',
  '9': 'sync', '11': 'billing', '12': 'analytics', '14': 'reports',
  '17': 'product-images', '18': 'catalog',
};

function findTestFiles(root: string, sid: string, epicKey: string): string[] {
  const found: string[] = [];
  const testDir = join(root, 'apps/api/test');
  if (!existsSync(testDir)) return found;

  // Collect all .ts files recursively
  const allFiles: Array<{ rel: string; name: string }> = [];
  function collectFiles(dir: string, prefix: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        collectFiles(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.ts')) {
        allFiles.push({ rel: `${prefix}${entry.name}`, name: entry.name });
      }
    }
  }
  collectFiles(testDir, '');

  // Primary: file path contains story ID string
  const pat = new RegExp(sid.replace('.', '[-.]'));
  for (const f of allFiles) if (pat.test(f.name) || pat.test(f.rel)) found.push(`apps/api/test/${f.rel}`);

  // Secondary: match by module name if primary found nothing
  if (!found.length) {
    const mod = MODULE_HINTS[epicKey];
    if (mod) for (const f of allFiles) if (f.name.includes(mod) || f.rel.includes(mod)) found.push(`apps/api/test/${f.rel}`);
  }
  return [...new Set(found)];
}

function smokeTest(sid: string): string {
  const epic = parseInt(sid.split('.')[0]);
  if (epic <= 6) return 'manual:shopkeeper-android';
  if (epic === 7 || epic >= 17) return 'ci:playwright';
  if (epic === 8 || epic === 9) return 'manual:shopkeeper-android';
  return 'none';
}

export async function generate(root: string): Promise<Record<string, unknown>> {
  const specFiles = globSync('docs/superpowers/specs/*.md', { cwd: root }).sort();
  const stories: StoryEntry[] = [];

  for (const rel of specFiles) {
    const filename = rel.split('/').pop() ?? '';
    const sid = storyId(filename);
    if (!sid) continue;
    const content = readFileSync(join(root, rel), 'utf8');
    const fm = parseFm(content);
    const epicKey = sid.split('.')[0];
    const testFiles = findTestFiles(root, sid, epicKey);
    const gaps: string[] = [];
    if (!testFiles.length) gaps.push('no-test-file');

    stories.push({
      id: sid,
      title: (fm.title ?? filename).replace(/^Story[\s\d.]+[—–-]\s*/, ''),
      class: fm.ceremonyClass ?? 'B',
      status: gaps.length ? 'partial' : 'complete',
      frs: fm.implements ?? [],
      specFile: rel.replace(/\\/g, '/'),
      testFiles,
      ciJobs: testFiles.length ? ['integration'] : [],
      smokeTest: smokeTest(sid),
      evidenceGaps: gaps,
    });
  }

  // Gap-closure story stubs from seed
  const seedPath = join(root, 'docs/agent-context/traceability-seed.json');
  if (existsSync(seedPath)) {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as { overrides: Array<{ wave?: string; id: string }> };
    const waves = [...new Set(seed.overrides.map(o => o.wave).filter(Boolean))] as string[];
    for (const wave of waves) {
      if (stories.some(s => s.id === wave)) continue;
      stories.push({
        id: wave,
        title: `Gap-closure: ${wave}`,
        class: 'B',
        status: 'planned',
        frs: seed.overrides.filter(o => o.wave === wave).map(o => o.id),
        specFile: '',
        testFiles: [],
        ciJobs: [],
        smokeTest: 'none',
        evidenceGaps: ['no-impl', 'no-test', 'no-spec'],
      });
    }
  }

  const withTest = stories.filter(s => s.testFiles.length > 0).length;
  const implemented = stories.filter(s => s.status !== 'planned').length;
  const implementedWithTest = stories.filter(s => s.status !== 'planned' && s.testFiles.length > 0).length;
  return {
    generated: new Date().toISOString(),
    summary: {
      total: stories.length,
      implemented,
      planned: stories.length - implemented,
      withTestEvidence: withTest,
      coveragePct: Math.round((withTest / stories.length) * 100),
      implementedCoveragePct: implemented > 0 ? Math.round((implementedWithTest / implemented) * 100) : 0,
    },
    stories,
  };
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/acceptance-evidence.json');
  generate(repoRoot).then(result => {
    const s = result.summary as Record<string, number>;
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`✓ acceptance-evidence.json written | ${s.total} stories | coverage: ${s.coveragePct}%`);
  }).catch(err => { console.error(err); process.exit(1); });
}
