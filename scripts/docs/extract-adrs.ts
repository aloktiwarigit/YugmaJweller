import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AdrEntry {
  id: string;
  title: string;
  status: 'accepted' | 'superseded' | 'draft' | 'proposed' | 'unknown';
  supersedes: string | null;
  supersededBy: string | null;
  rules: string[];
  path: string;
}

function parseAdr(filePath: string, relPath: string): AdrEntry {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const idMatch = relPath.match(/(\d{4})/);
  const id = idMatch ? `ADR-${idMatch[1]}` : 'ADR-UNKNOWN';

  const h1 = lines.find(l => l.startsWith('# '));
  const title = h1 ? h1.replace(/^#\s+\d+\s*[—–-]\s*/, '').trim() : id;

  const statusLine = lines.find(l => /\*\*Status:\*\*/i.test(l)) ?? '';
  const statusRaw = statusLine.replace(/.*\*\*Status:\*\*\s*/i, '').trim();

  let status: AdrEntry['status'] = 'unknown';
  if (/superseded/i.test(statusRaw)) status = 'superseded';
  else if (/accepted/i.test(statusRaw)) status = 'accepted';
  else if (/draft/i.test(statusRaw)) status = 'draft';
  else if (/proposed/i.test(statusRaw)) status = 'proposed';

  const supMatch = statusRaw.match(/supersedes\s+(ADR-\d{4}|\d{4})/i);
  const supersedes = supMatch
    ? (supMatch[1].startsWith('ADR-') ? supMatch[1] : `ADR-${supMatch[1]}`)
    : null;

  const supByMatch = statusRaw.match(/superseded by\s+(ADR-\d{4}|\d{4})/i);
  const supersededBy = supByMatch
    ? (supByMatch[1].startsWith('ADR-') ? supByMatch[1] : `ADR-${supByMatch[1]}`)
    : null;

  let inDecision = false;
  const rules: string[] = [];
  for (const line of lines) {
    if (/^##\s+Decision\b/i.test(line)) { inDecision = true; continue; }
    if (inDecision && /^##\s/.test(line)) break;
    if (inDecision && /^[-*]\s+/.test(line)) {
      const rule = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
      if (rule.length > 5) rules.push(rule);
    }
  }

  return { id, title, status, supersedes, supersededBy, rules, path: relPath };
}

export async function generate(root: string): Promise<Record<string, unknown>> {
  const adrDir = join(root, 'docs/adr');
  if (!existsSync(adrDir)) return { generated: new Date().toISOString(), adrs: [] };

  const files = readdirSync(adrDir)
    .filter(f => f.endsWith('.md') && !/readme/i.test(f))
    .sort();

  const adrs = files.map(f => parseAdr(join(adrDir, f), `docs/adr/${f}`));
  return { generated: new Date().toISOString(), adrs };
}

if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
  const repoRoot = resolve(__dirname, '../..');
  const outPath = join(repoRoot, 'docs/agent-context/decision-index.json');
  generate(repoRoot).then(result => {
    const count = (result.adrs as unknown[]).length;
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`✓ decision-index.json written (${count} ADRs)`);
  }).catch(err => { console.error(err); process.exit(1); });
}
