import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const tmpDir = path.resolve('.lighthouseci', 'tmp');
mkdirSync(tmpDir, { recursive: true });

const args = ['exec', 'lhci', 'autorun', ...process.argv.slice(2).filter((arg) => arg !== '--')];
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => !key.startsWith('=') && value !== undefined),
);

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...env,
    TEMP: tmpDir,
    TMP: tmpDir,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
