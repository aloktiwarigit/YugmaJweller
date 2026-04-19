type Locale = 'hi-IN' | 'en-IN';

import hiAuth from './locales/hi-IN/auth.json';
import hiCommon from './locales/hi-IN/common.json';
import hiDashboard from './locales/hi-IN/dashboard.json';
import enAuth from './locales/en-IN/auth.json';
import enCommon from './locales/en-IN/common.json';
import enDashboard from './locales/en-IN/dashboard.json';

const BUNDLES: Record<Locale, Record<string, unknown>> = {
  'hi-IN': { auth: hiAuth, common: hiCommon, dashboard: hiDashboard },
  'en-IN': { auth: enAuth, common: enCommon, dashboard: enDashboard },
};

let current: Locale = 'hi-IN';

export function setLocale(l: Locale): void {
  current = l;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const parts = key.split('.');
  let v: unknown = BUNDLES[current];
  for (const p of parts) {
    if (v && typeof v === 'object') v = (v as Record<string, unknown>)[p];
    else { v = undefined; break; }
  }
  if (typeof v !== 'string') {
    console.warn(`[i18n.missing] ${key}`);
    return `[${key}]`;
  }
  return v.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
