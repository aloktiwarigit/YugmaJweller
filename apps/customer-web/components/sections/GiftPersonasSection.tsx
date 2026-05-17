import Image from 'next/image';
import { STOREFRONT_GIFT_PERSONAS } from '@goldsmith/customer-shared';
import type { Collection } from '@goldsmith/customer-shared';
import { SectionHeading } from './SectionHeading';

interface GiftPersonasSectionProps {
  collections?: Collection[];
}

const PERSONA_COLLECTIONS: Record<string, string> = {
  mother: 'gift-ready',
  sister: 'minimal-edit',
  wife: 'diamond-glow',
  bride: 'bridal-edit',
  self: 'daily-gold',
  friend: 'silver-style',
};

function collectionForPersona(collections: Collection[], key: string, index: number): Collection | undefined {
  const preferredSlug = PERSONA_COLLECTIONS[key];
  const imageCollections = collections.filter((collection) => collection.heroImage);
  return (
    collections.find((collection) => collection.slug === preferredSlug && collection.heroImage) ??
    imageCollections[index % Math.max(imageCollections.length, 1)]
  );
}

export function GiftPersonasSection({ collections = [] }: GiftPersonasSectionProps) {
  return (
    <section aria-labelledby="gift-personas-heading" className="py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          id="gift-personas-heading"
          titleHi="किसके लिए उपहार?"
          eyebrowHi="गिफ्ट"
          eyebrowEn="Gift"
        />

        <div className="hidden grid-cols-6 gap-4 md:grid">
          {STOREFRONT_GIFT_PERSONAS.map((persona, index) => {
            const collection = collectionForPersona(collections, persona.key, index);
            const image = collection?.heroImage;

            return (
              <a
                key={persona.key}
                href={persona.href}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-borderSubtle transition-all hover:border-borderStrong hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
                style={{ aspectRatio: '4/5' }}
              >
                {image ? (
                  <Image
                    src={image.url}
                    alt={image.alt ?? persona.labelHi}
                    fill
                    sizes="180px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    placeholder={image.placeholderUrl ? 'blur' : 'empty'}
                    blurDataURL={image.placeholderUrl || undefined}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-primaryWash" aria-hidden="true">
                    <span className="font-heading text-5xl text-primary/30">{persona.labelHi.slice(0, 1)}</span>
                  </div>
                )}
                <div
                  className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8"
                  style={{ background: 'linear-gradient(to top, rgba(245,237,221,0.94) 0%, transparent 100%)' }}
                >
                  <p className="font-prose text-xs italic text-inkSoft">गिफ्ट / Gift</p>
                  <p className="font-heading text-base leading-tight text-ink">{persona.labelHi}</p>
                </div>
              </a>
            );
          })}
        </div>

        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:hidden"
          style={{ scrollPaddingLeft: '1rem' }}
        >
          {STOREFRONT_GIFT_PERSONAS.map((persona, index) => {
            const collection = collectionForPersona(collections, persona.key, index);
            const image = collection?.heroImage;

            return (
              <a
                key={persona.key}
                href={persona.href}
                className="relative flex shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-borderSubtle focus-visible:outline-2 focus-visible:outline-primary"
                style={{ width: '56vw', aspectRatio: '4/5' }}
              >
                {image ? (
                  <Image
                    src={image.url}
                    alt={image.alt ?? persona.labelHi}
                    fill
                    sizes="56vw"
                    className="object-cover"
                    placeholder={image.placeholderUrl ? 'blur' : 'empty'}
                    blurDataURL={image.placeholderUrl || undefined}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-primaryWash" aria-hidden="true">
                    <span className="font-heading text-5xl text-primary/30">{persona.labelHi.slice(0, 1)}</span>
                  </div>
                )}
                <div
                  className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8"
                  style={{ background: 'linear-gradient(to top, rgba(245,237,221,0.94) 0%, transparent 100%)' }}
                >
                  <p className="font-prose text-xs italic text-inkSoft">गिफ्ट</p>
                  <p className="font-heading text-base text-ink">{persona.labelHi}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
