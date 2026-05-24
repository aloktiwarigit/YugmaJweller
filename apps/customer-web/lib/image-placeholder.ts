export function imagePlaceholderProps(
  src: string,
  placeholderUrl?: string | null,
): { placeholder: 'blur' | 'empty'; blurDataURL?: string } {
  const blurDataURL = usableBlurDataUrl(src, placeholderUrl);
  return blurDataURL
    ? { placeholder: 'blur', blurDataURL }
    : { placeholder: 'empty' };
}

function usableBlurDataUrl(src: string, placeholderUrl?: string | null): string | undefined {
  const value = placeholderUrl?.trim();
  if (!value) return undefined;

  if (value.startsWith('data:image/')) return value;

  // Public demo assets do not have separate LQIP derivatives; the API returns
  // the full JPEG for placeholderUrl. Passing that to next/image makes the
  // browser fetch the original image in addition to the optimized image.
  if (value.startsWith('/demo-shop/')) return undefined;
  if (value === src) return undefined;

  return value;
}
