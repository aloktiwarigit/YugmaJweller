export function storefrontImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/demo-shop/') || parsed.pathname.startsWith('/assets/')) {
      return parsed.pathname;
    }
  } catch {
    // Relative URLs are already valid in the storefront.
  }
  return url;
}

export function storefrontBlurDataUrl(url: string | null | undefined): string | undefined {
  return url?.startsWith('data:') ? url : undefined;
}

export function storefrontSrcSet(srcset: string | null | undefined): string | undefined {
  if (!srcset?.trim()) return undefined;
  return srcset
    .split(',')
    .map((entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/, 2);
      if (!url) return '';
      return [storefrontImageUrl(url), descriptor].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(', ');
}
