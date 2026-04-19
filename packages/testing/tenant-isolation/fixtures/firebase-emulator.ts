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

/**
 * Start the Firebase Auth emulator on a per-worker port to avoid singleton collisions
 * when Vitest runs parallel workers.
 *
 * @param options.port  Explicit port override. If omitted, derived from VITEST_WORKER_ID
 *                      (range 9099–9198) so parallel workers never share a port.
 * @param options.projectId  Firebase project ID.
 * @returns  The resolved port number (callers should use this instead of hardcoding 9099).
 */
export async function startFirebaseAuthEmulator(options: { port?: number; projectId: string }): Promise<{ port: number }> {
  // Per-worker port: VITEST_WORKER_ID is set for each parallel worker (1-based).
  const workerId = Number(process.env['VITEST_WORKER_ID'] ?? process.env['VITEST_POOL_ID'] ?? '0');
  const port = options.port ?? (9099 + (workerId % 100));

  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${port}`;
  process.env['GCLOUD_PROJECT'] = options.projectId;
  process.env['FIREBASE_PROJECT_ID'] = options.projectId;

  // If another worker already started the emulator on this port, reuse it.
  const alreadyUp = await isPortOpen('127.0.0.1', port);
  if (alreadyUp) {
    console.log(`[firebase-emulator] port ${port} already open — reusing`);
    return { port };
  }

  proc = spawn('firebase', [
    'emulators:start',
    '--only', 'auth',
    '--project', options.projectId,
    '--port', String(port),
  ], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, AUTH_EMULATOR_PORT: String(port) },
  });
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

  return { port };
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
