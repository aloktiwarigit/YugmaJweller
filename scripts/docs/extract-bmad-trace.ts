import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import { globSync } from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FrEntry {
  id: string;
  title: string;
  epic: string;
  story: string;
  status: 'complete' | 'partial' | 'missing' | 'planned';
  evidence: 'code-verified' | 'spec-only' | 'missing';
  wave: string | null;
  specFile: string | null;
  codeModule: string | null;
  testFile: string | null;
  ciJob: string | null;
}

interface SeedOverride {
  id: string;
  title?: string;
  status: 'complete' | 'partial' | 'missing' | 'planned';
  wave?: string;
  epic?: string;
  story?: string;
}

interface SpecFm {
  implements?: (string | number)[];
  ceremonyClass?: string;
}

function storyIdFromFilename(name: string): string | null {
  const m = name.match(/story-([\d.]+)-/);
  return m ? m[1] : null;
}

function parseFm(content: string): SpecFm {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try { return parseYaml(m[1]) as SpecFm; } catch { return {}; }
}

/**
 * Extract FR ID from implements list entries.
 * Handles both clean IDs ("FR8") and annotated strings ("FR8 (shopkeeper OTP login)").
 */
function extractFrId(raw: string | number): string | null {
  const s = String(raw).trim();
  const m = s.match(/^(FR\d+)/);
  return m ? m[1] : null;
}

// Grep FR refs from code — Windows-safe
function grepFrRefs(root: string): Set<string> {
  const found = new Set<string>();
  const isWin = process.platform === 'win32';
  if (!isWin) {
    try {
      const out = execSync('grep -rh --include="*.ts" "// FR[0-9]" apps/api/src', { encoding: 'utf8', cwd: root });
      for (const m of out.matchAll(/\/\/ (FR\d+)/g)) found.add(m[1]);
    } catch { /* nothing found */ }
  } else {
    const files = globSync('apps/api/src/**/*.ts', { cwd: root, absolute: true });
    for (const f of files) {
      try {
        const content = readFileSync(f, 'utf8');
        for (const m of content.matchAll(/\/\/ (FR\d+)/g)) found.add(m[1]);
      } catch { /* skip unreadable */ }
    }
  }
  return found;
}

function findTestFile(root: string, moduleHint: string | null): string | null {
  if (!moduleHint) return null;
  const moduleName = moduleHint.split('/').pop() ?? '';
  const testDir = join(root, 'apps/api/test');
  if (!existsSync(testDir)) return null;
  const match = readdirSync(testDir).find(f => f.includes(moduleName));
  return match ? `apps/api/test/${match}` : null;
}

const MODULE_HINTS: Record<string, string | null> = {
  '1': 'apps/api/src/modules/auth',
  '2': 'apps/api/src/modules/settings',
  '3': 'apps/api/src/modules/inventory',
  '4': 'apps/api/src/modules/pricing',
  '5': 'apps/api/src/modules/billing',
  '6': 'apps/api/src/modules/crm',
  '7': 'apps/api/src/modules/catalog',
  '8': 'apps/api/src/modules/loyalty',
  '9': 'packages/sync/src',
  '11': 'apps/api/src/modules/billing',
  '12': 'apps/api/src/modules/analytics-dashboards',
  '13': 'apps/api/src/modules/notifications',
  '14': 'apps/api/src/modules/reports',
  '15': 'apps/api/src/modules/platform-admin',
  '16': 'apps/api/src/modules/platform-admin',
  '17': 'apps/api/src/modules/inventory/product-images',
  '18': 'apps/api/src/modules/catalog',
};

// Known FR titles for bootstrap accuracy (covers FR1-FR20 and key FRs)
const FR_TITLES: Record<string, string> = {
  FR1: 'Tenant provisioning', FR2: 'Staff onboarding via invite',
  FR3: 'Staff role and permission management', FR4: 'Staff offboarding',
  FR5: 'Shopkeeper OTP login and session', FR6: 'Staff OTP login',
  FR7: 'Owner unlock and account security', FR8: 'Shop profile configuration',
  FR9: 'Making charges configuration', FR10: 'Wastage percentage configuration',
  FR11: 'Rate-lock duration configuration', FR12: 'Try-at-home toggle and piece count',
  FR13: 'Custom order policy', FR14: 'Return policy', FR15: 'Notification preferences',
  FR16: 'Loyalty tier configuration', FR17: 'Barcode label printing',
  FR18: 'Bulk CSV import', FR19: 'Product status state machine',
  FR20: 'Publish/unpublish product',
};

export async function generate(root: string): Promise<Record<string, unknown>> {
  const seedPath = join(root, 'docs/agent-context/traceability-seed.json');
  const seed: { overrides: SeedOverride[] } = existsSync(seedPath)
    ? JSON.parse(readFileSync(seedPath, 'utf8'))
    : { overrides: [] };
  const seedMap = new Map(seed.overrides.map(o => [o.id, o]));

  // Build FR→spec map from spec frontmatter
  const specFiles = globSync('docs/superpowers/specs/*.md', { cwd: root });
  const frToSpec = new Map<string, { specFile: string; storyId: string; codeModule: string | null }>();
  for (const rel of specFiles) {
    const filename = rel.split('/').pop() ?? '';
    const storyId = storyIdFromFilename(filename);
    if (!storyId) continue;
    const content = readFileSync(join(root, rel), 'utf8');
    const fm = parseFm(content);
    const epicKey = storyId.split('.')[0];
    const codeModule = MODULE_HINTS[epicKey] ?? null;
    for (const rawEntry of fm.implements ?? []) {
      const frId = extractFrId(rawEntry);
      if (frId && !frToSpec.has(frId)) {
        frToSpec.set(frId, { specFile: rel.replace(/\\/g, '/'), storyId, codeModule });
      }
    }
  }

  const codeRefs = grepFrRefs(root);
  const frs: FrEntry[] = [];
  const gaps: FrEntry[] = [];

  for (let i = 1; i <= 140; i++) {
    const id = `FR${i}`;
    const seedEntry = seedMap.get(id);
    const spec = frToSpec.get(id);
    const inCode = codeRefs.has(id);

    let entry: FrEntry;

    if (seedEntry) {
      entry = {
        id,
        title: seedEntry.title ?? FR_TITLES[id] ?? id,
        epic: seedEntry.epic ?? '',
        story: seedEntry.story ?? '',
        status: seedEntry.status,
        evidence: (seedEntry.status === 'missing' || seedEntry.status === 'planned')
          ? 'missing'
          : inCode ? 'code-verified' : 'spec-only',
        wave: seedEntry.wave ?? null,
        specFile: spec?.specFile ?? null,
        codeModule: spec?.codeModule ?? null,
        testFile: null,
        ciJob: null,
      };
    } else if (spec) {
      const testFile = findTestFile(root, spec.codeModule);
      const evidence = (testFile || inCode) ? 'code-verified' : 'spec-only';
      entry = {
        id,
        title: FR_TITLES[id] ?? id,
        epic: `E${spec.storyId.split('.')[0]}`,
        story: spec.storyId,
        status: evidence === 'code-verified' ? 'complete' : 'partial',
        evidence,
        wave: null,
        specFile: spec.specFile,
        codeModule: spec.codeModule,
        testFile,
        ciJob: 'integration',
      };
    } else {
      entry = {
        id,
        title: FR_TITLES[id] ?? id,
        epic: '',
        story: '',
        status: 'missing',
        evidence: 'missing',
        wave: null,
        specFile: null,
        codeModule: null,
        testFile: null,
        ciJob: null,
      };
      gaps.push(entry);
    }

    if (seedEntry && (entry.status === 'missing' || entry.status === 'planned')) gaps.push(entry);
    frs.push(entry);
  }

  const summary = {
    total: frs.length,
    complete: frs.filter(f => f.status === 'complete').length,
    partial: frs.filter(f => f.status === 'partial').length,
    missing: frs.filter(f => f.status === 'missing').length,
    planned: frs.filter(f => f.status === 'planned').length,
  };

  return { generated: new Date().toISOString(), summary, frs, gaps };
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/traceability.json');
  generate(repoRoot).then(result => {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    const s = result.summary as Record<string, number>;
    console.log(`✓ traceability.json written | complete:${s.complete} partial:${s.partial} missing:${s.missing} planned:${s.planned}`);
  }).catch(err => { console.error(err); process.exit(1); });
}
