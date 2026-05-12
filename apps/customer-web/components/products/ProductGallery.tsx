'use client';

import { useEffect, useRef, useState } from 'react';
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
  return image.alt_text ?? `${productName} - तस्वीर ${index + 1}`;
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  const hero = images[activeIndex] ?? null;
  const heroAlt = hero ? altFor(hero, productName, activeIndex) : `${productName} की तस्वीर`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxOpen && !dialog.open) {
      dialog.showModal();
    } else if (!lightboxOpen && dialog.open) {
      dialog.close();
    }
  }, [lightboxOpen]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label={`${heroAlt} (बड़ा देखने के लिए क्लिक करें)`}
        >
          {hero ? (
            <ResponsiveImage
              src={hero.default_url}
              srcset={hero.srcset}
              sizes={SIZES}
              alt={heroAlt}
              width={hero.width}
              height={hero.height}
              loading="eager"
              className="h-auto w-full"
            />
          ) : (
            <GoldTexturePlaceholder className="h-auto w-full" />
          )}
        </button>

        {images.length > 1 && (
          <div
            className="flex gap-2 overflow-x-auto lg:max-h-[600px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
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
                  className="h-20 w-20 rounded object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setLightboxOpen(false)}
        onKeyDown={(e) => {
          if (images.length < 2) return;
          if (e.key === 'ArrowRight') {
            setActiveIndex((i) => Math.min(i + 1, images.length - 1));
          }
          if (e.key === 'ArrowLeft') {
            setActiveIndex((i) => Math.max(i - 1, 0));
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLightboxOpen(false);
        }}
        className="fixed inset-0 z-50 m-0 h-screen max-h-none w-screen max-w-none border-0 bg-black/90 p-0 backdrop:bg-black/90"
        aria-label="तस्वीर बड़ी करें"
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl leading-none text-white hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="बंद करें"
        >
          ×
        </button>
        <div className="flex h-full items-center justify-center p-8">
          {hero ? (
            <ResponsiveImage
              src={hero.default_url}
              srcset={hero.srcset}
              sizes="(max-width: 1280px) 100vw, 1280px"
              alt={heroAlt}
              width={hero.width}
              height={hero.height}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="w-full max-w-xl rounded-lg bg-bg">
              <GoldTexturePlaceholder className="h-auto w-full" />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
