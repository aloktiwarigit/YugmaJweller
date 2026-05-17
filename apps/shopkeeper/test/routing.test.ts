import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(__dirname, '..');

describe('Expo Router tabs', () => {
  it('declares only routes that exist under the tabs group', () => {
    const tabsDir = resolve(appRoot, 'app', '(tabs)');
    const layout = readFileSync(resolve(tabsDir, '_layout.tsx'), 'utf8');
    const declaredTabs = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const existingTabs = new Set(
      readdirSync(tabsDir)
        .filter((name) => name.endsWith('.tsx') && name !== '_layout.tsx')
        .map((name) => name.replace(/\.tsx$/, '')),
    );

    expect(declaredTabs).not.toContain('settings');
    expect(declaredTabs.every((name) => existingTabs.has(name))).toBe(true);
    expect(declaredTabs.some((name) => existsSync(resolve(appRoot, 'app', name, 'index.tsx'))))
      .toBe(false);
  });
});
