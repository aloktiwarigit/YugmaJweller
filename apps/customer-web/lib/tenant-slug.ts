interface HeaderGetter {
  get(name: string): string | null;
}

const LOCAL_DEV_SHOP_SLUG = 'anchor-dev';

function normalizeSlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase();
  if (!slug) return null;
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

function hostnameFromHostHeader(hostHeader: string | null): string | null {
  const host = hostHeader?.trim().toLowerCase();
  if (!host) return null;

  if (host.startsWith('[')) {
    const closingBracket = host.indexOf(']');
    return closingBracket > 1 ? host.slice(1, closingBracket) : null;
  }

  return host.split(':')[0] ?? null;
}

function isLocalHostname(hostname: string | null): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function resolveShopSlug(
  headers: HeaderGetter,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicitHeader = normalizeSlug(headers.get('x-shop-slug'));
  if (explicitHeader) return explicitHeader;

  const configuredSlug = normalizeSlug(env['NEXT_PUBLIC_SHOP_SLUG']);
  if (configuredSlug) return configuredSlug;

  const hostname = hostnameFromHostHeader(headers.get('host'));
  if (isLocalHostname(hostname)) return LOCAL_DEV_SHOP_SLUG;

  return null;
}
