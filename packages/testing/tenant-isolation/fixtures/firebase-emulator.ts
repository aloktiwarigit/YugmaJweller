import { spawn, type ChildProcess } from 'node:child_process';

let proc: ChildProcess | undefined;
const STARTUP_WAIT_MS = 10_000;

export async function startFirebaseAuthEmulator(options: { port: number; projectId: string }): Promise<void> {
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${options.port}`;
  process.env['GCLOUD_PROJECT'] = options.projectId;
  process.env['FIREBASE_PROJECT_ID'] = options.projectId;
  proc = spawn('firebase', [
    'emulators:start',
    '--only', 'auth',
    '--project', options.projectId,
  ], { stdio: 'pipe', shell: true });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('firebase emulator startup timeout')), STARTUP_WAIT_MS);
    proc?.stdout?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      if (s.includes('All emulators ready') || s.includes('auth: Emulator started')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc?.stderr?.on('data', (chunk: Buffer) => {
      // Surface startup errors quickly
      if (/error|fail/i.test(chunk.toString())) {
        console.error('firebase emulator stderr:', chunk.toString());
      }
    });
    proc?.on('exit', (code) => { if (code !== null && code !== 0) reject(new Error(`firebase emulator exited ${code}`)); });
  });
}

export async function stopFirebaseAuthEmulator(): Promise<void> {
  if (!proc) return;
  proc.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2000);
    proc?.on('exit', () => { clearTimeout(t); resolve(); });
  });
  proc = undefined;
  delete process.env['FIREBASE_AUTH_EMULATOR_HOST'];
}
