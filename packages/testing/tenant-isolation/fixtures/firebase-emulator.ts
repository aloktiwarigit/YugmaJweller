import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';

let proc: ChildProcess | undefined;
const STARTUP_WAIT_MS = 30_000;

/** Returns true if something is already listening on the given port. */
function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.setTimeout(500);
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
  });
}

export async function startFirebaseAuthEmulator(options: { port: number; projectId: string }): Promise<void> {
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${options.port}`;
  process.env['GCLOUD_PROJECT'] = options.projectId;
  process.env['FIREBASE_PROJECT_ID'] = options.projectId;

  // If another worker already started the emulator on this port, skip startup.
  const alreadyUp = await isPortOpen('127.0.0.1', options.port);
  if (alreadyUp) {
    console.log(`[firebase-emulator] port ${options.port} already open — skipping startup`);
    return;
  }

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
    proc?.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) reject(new Error(`firebase emulator exited ${code}`));
    });
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
