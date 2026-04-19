// Minimal expo-router mock for vitest/jsdom.
// Individual test files override specific exports via vi.mock('expo-router', ...).
// This file is the base module that the vitest alias points to.

export const router = {
  replace: (_path: string): void => { /* stub */ },
  push: (_path: string): void => { /* stub */ },
  back: (): void => { /* stub */ },
};

export const useRouter = (): typeof router => router;

export function Redirect(_props: { href: string }): null {
  return null;
}

export function Stack(_props: Record<string, unknown>): null {
  return null;
}

export function Tabs(_props: Record<string, unknown>): null {
  return null;
}
