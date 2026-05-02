'use client';

import type { ReactElement } from 'react';

type Props = {
  src: string;
  srcset: string;
  sizes: string;
  alt: string;
  width: number;
  height: number;
  loading?: 'lazy' | 'eager';
  className?: string;
};

export function ResponsiveImage({
  src,
  srcset,
  sizes,
  alt,
  width,
  height,
  loading = 'lazy',
  className,
}: Props): ReactElement {
  return (
    <img
      src={src}
      srcSet={srcset}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={className}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
