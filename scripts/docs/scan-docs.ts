import { readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type DocKind = 'requirements' | 'plan' | 'spec' | 'review' | 'adr' | 'research' | 'runbook' | 'audit' | 'other';

function inferKind(p: string): DocKind {
  if (p.includes('docs/adr/')) return 'adr';
  if (p.includes('superpowers/specs')) return 'spec';
  if (p.includes('superpowers/plans')) return 'plan';
  if (p.includes('/reviews/')) return 'review';
  if (p.includes('/runbooks/')) return 'runbook';
  if (p.includes('/research/')) return 'research';
  if (/prd|epics/.test(p)) return 'requirements';
  if (/audit|quality.gate/.test(p)) return 'audit';
  return 'other';
}

function inferAvoid(p: string): boolean {
  return (
    p.startsWith('_bmad-output/planning-artifacts/research/') ||
    p.includes('docs/reviews/') ||
    p.includes('docs/superpowers/plans/') ||
    p.endsWith('.html')
  );
}

function inferReadWhen(kind: DocKind, p: string): string {
  if (kind === 'adr') return 'checking architecture decisions';
  if (kind === 'spec') return 'implementing or reviewing a specific story';
  if (kind === 'plan') return 'executing a specific story — read only that story\'s plan';
  if (kind === 'review') return 'historical context only — not for completion proof';
  if (kind === 'runbook') return 'incident response or ops procedures';
  if (kind === 'research') return 'domain/market background only';
  if (p.includes('prd.md')) return 'authoring or reviewing FR definitions';
  if (p.includes('epics')) return 'story decomposition and epic scoping';
  if (kind === 'audit') return 'gap analysis or completion assessment';
  return 'reference only';
}

export async function generate(root: string): Promise<Record<string, unknown>> {
  const patterns = ['docs/**/*.md', '_bmad-output/**/*.md'];
  const files = globSync(patterns, { cwd: root }).sort();

  const docs = files.map(relPath => {
    const normPath = relPath.replace(/\\/g, '/');
    let lineCount = 0;
    try { lineCount = readFileSync(join(root, normPath), 'utf8').split('\n').length; } catch { /* skip */ }
    const kind = inferKind(normPath);
    return {
      path: normPath,
      kind,
      estimatedTokens: Math.ceil(lineCount * 10),
      readWhen: inferReadWhen(kind, normPath),
      avoidByDefault: inferAvoid(normPath),
      supersededBy: null as string | null,
    };
  });

  return { generated: new Date().toISOString(), docs };
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/doc-index.json');
  generate(repoRoot).then(result => {
    const all = result.docs as unknown[];
    const avoided = (result.docs as Array<{ avoidByDefault: boolean }>).filter(d => d.avoidByDefault).length;
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`✓ doc-index.json written (${all.length} docs, ${avoided} avoidByDefault)`);
  }).catch(err => { console.error(err); process.exit(1); });
}
