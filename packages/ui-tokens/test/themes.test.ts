import { describe, it, expect } from 'vitest';
import {
  THEMES,
  THEME_PRESETS,
  DEFAULT_THEME_ID,
  YATRA_ONE,
  BANARAS_MAROON,
  isThemeId,
  type ThemeColors,
} from '../src/themes';
import { colors } from '../src/colors';

const REQUIRED_COLOR_KEYS: readonly (keyof ThemeColors)[] = [
  'primary',
  'accent',
  'bg',
  'ink',
  'inkMute',
  'border',
  'error',
  'textPrimary',
  'textSecondary',
  'primaryLight',
  'white',
  'background',
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('themes — preset registry', () => {
  it('exposes both presets via THEMES record', () => {
    expect(Object.keys(THEMES).sort()).toEqual(['banaras-maroon', 'yatra-one']);
  });

  it('THEME_PRESETS lists both presets in order (default first)', () => {
    expect(THEME_PRESETS).toHaveLength(2);
    expect(THEME_PRESETS[0]?.id).toBe(DEFAULT_THEME_ID);
  });

  it('default theme id is yatra-one (anchor lock)', () => {
    expect(DEFAULT_THEME_ID).toBe('yatra-one');
  });
});

describe.each([
  ['yatra-one', YATRA_ONE],
  ['banaras-maroon', BANARAS_MAROON],
])('themes — %s preset shape', (_id, preset) => {
  it('has every required color key', () => {
    for (const key of REQUIRED_COLOR_KEYS) {
      expect(preset.colors[key]).toBeDefined();
    }
  });

  it('every color value is a 6-char hex literal', () => {
    for (const key of REQUIRED_COLOR_KEYS) {
      expect(preset.colors[key]).toMatch(HEX);
    }
  });

  it('has a non-empty displayName', () => {
    expect(preset.displayName.length).toBeGreaterThan(0);
  });

  it('id matches the registry key', () => {
    expect(THEMES[preset.id]).toBe(preset);
  });
});

describe('themes — yatra-one parity with colors.ts', () => {
  // The default preset MUST exactly mirror the existing `colors` export so
  // screens that opt into useThemeTokens() render identically to screens
  // still importing `colors` directly. Drift here would break the demo.
  it('every key in colors.ts is present in YATRA_ONE.colors with the same value', () => {
    for (const [k, v] of Object.entries(colors)) {
      expect(YATRA_ONE.colors[k as keyof ThemeColors]).toBe(v);
    }
  });
});

describe('themes — contrast invariant', () => {
  // The Banaras preset must visibly differ on the keys most likely to drive
  // the "this is a different brand" gut reaction during a demo.
  it('primary, bg, and ink differ between yatra-one and banaras-maroon', () => {
    expect(BANARAS_MAROON.colors.primary).not.toBe(YATRA_ONE.colors.primary);
    expect(BANARAS_MAROON.colors.bg).not.toBe(YATRA_ONE.colors.bg);
    expect(BANARAS_MAROON.colors.ink).not.toBe(YATRA_ONE.colors.ink);
  });
});

describe('themes — isThemeId type guard', () => {
  it('accepts known theme ids', () => {
    expect(isThemeId('yatra-one')).toBe(true);
    expect(isThemeId('banaras-maroon')).toBe(true);
  });

  it('rejects unknown values, undefined, null, numbers, objects', () => {
    expect(isThemeId('mumbai-neon')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(42)).toBe(false);
    expect(isThemeId({})).toBe(false);
  });
});
