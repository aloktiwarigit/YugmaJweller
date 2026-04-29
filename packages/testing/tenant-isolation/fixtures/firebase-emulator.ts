import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';

let proc: ChildProcess | undefined;
const STARTUP_WAIT_MS = 30_000;

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.setTimeout(500);
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function isEmulatorResponsive(host: string, port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`http://${host}:${port}/`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

function parseEmulatorHost(value: string | undefined): { host: string; port: number } | undefined {
  if (!value) return undefined;
  const [host, portStr] = value.split(':');
  const port = Number(portStr);
  if (!host || !Number.isFinite(port)) return undefined;
  return { host, port };
}

/**
 * Start the Firebase Auth emulator, or reuse a pre-existing one.
 *
 * Behavior:
 * - If FIREBASE_AUTH_EMULATOR_HOST is already set (CI env, or a prior test's setup),
 *   skip spawning. The shared emulator's lifetime is managed by CI (or the parent
 *   shell); this fixture just consumes it.
 * - Otherwise (local dev), spawn one emulator on port 9099 using firebase.json config
 *   (no --port CLI flag — Firebase CLI takes port from firebase.json only).
 *
 * Returns the port the Admin SDK + tests should use.
 */
export async function startFirebaseAuthEmulator(options: { projectId: string; port?: number }): Promise<{ port: number }> {
  process.env['GCLOUD_PROJECT'] = options.projectId;
  process.env['FIREBASE_PROJECT_ID'] = options.projectId;

  // If CI (or a prior setup) already provisioned an emulator, consume it.
  const preset = parseEmulatorHost(process.env['FIREBASE_AUTH_EMULATOR_HOST']);
  if (preset) {
    const responsive = await isEmulatorResponsive(preset.host, preset.port);
    if (responsive) {
      console.log(`[firebase-emulator] reusing emulator at ${preset.host}:${preset.port}`);
      return { port: preset.port };
    }
    console.warn(`[firebase-emulator] FIREBASE_AUTH_EMULATOR_HOST=${preset.host}:${preset.port} set but emulator not responsive — attempting to spawn.`);
  }

  const port = options.port ?? 9099;
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${port}`;

  // Skip spawn if the port is already serving something (another test file in
  // the same process already started it, or a local `firebase emulators:start`
  // is running). Verify HTTP responsiveness, not just TCP — a dying emulator
  // (SIGTERM sent but port not yet released) passes a TCP check but drops HTTP
  // connections, causing verifyIdToken to fail with ECONNREFUSED mid-test.
  const alreadyUp = await isPortOpen('127.0.0.1', port);
  if (alreadyUp) {
    const live = await isEmulatorResponsive('127.0.0.1', port);
    if (live) {
      console.log(`[firebase-emulator] port ${port} already open — reusing`);
      return { port };
    }
    console.log(`[firebase-emulator] port ${port} open but emulator unresponsive (dying) — waiting for port to close`);
    await new Promise<void>((r) => setTimeout(r, 3000));
  }

  // Port configured in firebase.json. DO NOT pass --port (not a valid CLI flag).
  proc = spawn('firebase', ['emulators:start', '--only', 'auth', '--project', options.projectId], {
    stdio: 'pipe',
    shell: true,
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
      if (/error|fail/i.test(chunk.toString())) console.error('firebase emulator stderr:', chunk.toString());
    });
    proc?.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) reject(new Error(`firebase emulator exited ${code}`));
    });
  });
  return { port };
}

export async function stopFirebaseAuthEmulator(): Promise<void> {
  if (!proc) return; // reused someone else's — don't stop
  proc.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2000);
    proc?.on('exit', () => { clearTimeout(t); resolve(); });
  });
  proc = undefined;
}
