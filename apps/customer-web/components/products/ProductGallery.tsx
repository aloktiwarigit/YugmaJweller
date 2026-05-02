'use client';

import { useState } from 'react';
import { ResponsiveImage } from '@goldsmith/ui-web';
import { GoldTexturePlaceholder } from '@/components/GoldTexturePlaceholder';

export type PublicImageRow = {
  id: string;
  alt_text: string | null;
  width: number;
  height: number;
  srcset: string;
  default_url: string;
  placeholder_url: string;
};

const SIZES = '(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 800px';

function altFor(image: PublicImageRow, productName: string, index: number): string {
  return image.alt_text ?? `${productName} – तस्वीर ${index + 1}`;
}

export function ProductGallery({
  images,
  productName,
}: {
  images: PublicImageRow[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return <GoldTexturePlaceholder />;
  }

  const hero = images[activeIndex]!;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        {/* Hero */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label={`${altFor(hero, productName, activeIndex)} (बड़ा देखने के लिए क्लिक करें)`}
        >
          <ResponsiveImage
            src={hero.default_url}
            srcset={hero.srcset}
            sizes={SIZES}
            alt={altFor(hero, productName, activeIndex)}
            width={hero.width}
            height={hero.height}
            loading="eager"
            className="w-full h-auto"
          />
        </button>

        {/* Thumb strip — only when more than one image */}
        {images.length > 1 && (
          <div
            className="flex gap-2 lg:flex-col overflow-x-auto lg:overflow-x-visible lg:max-h-[600px] lg:overflow-y-auto"
            role="tablist"
            aria-label="उत्पाद की तस्वीरें"
          >
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 rounded border-2 ${
                  i === activeIndex ? 'border-amber-500' : 'border-transparent'
                } focus:outline-none focus:ring-2 focus:ring-amber-500`}
              >
                <ResponsiveImage
                  src={img.placeholder_url}
                  srcset={img.srcset}
                  sizes="80px"
                  alt={altFor(img, productName, i)}
                  width={80}
                  height={80}
                  className="w-20 h-20 object-cover rounded"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <dialog
          open
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxOpen(false);
            if (e.key === 'ArrowRight')
              setActiveIndex((i) => Math.min(i + 1, images.length - 1));
            if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(i - 1, 0));
          }}
          className="fixed inset-0 w-screen h-screen bg-black/90 z-50 m-0 p-0 max-w-none max-h-none border-0"
          aria-label="तस्वीर बड़ी करें"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="बंद करें"
          >
            ✕
          </button>
          <div className="flex items-center justify-center h-full p-8">
            <ResponsiveImage
              src={hero.default_url}
              srcset={hero.srcset}
              sizes="(max-width: 1280px) 100vw, 1280px"
              alt={altFor(hero, productName, activeIndex)}
              width={hero.width}
              height={hero.height}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </dialog>
      )}
    </>
  );
}
