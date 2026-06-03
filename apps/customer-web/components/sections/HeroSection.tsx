import Image from 'next/image';
import Link from 'next/link';
import { storefrontImageUrl } from '@/lib/image-url';

interface HeroBanner {
  imageUrl: string;
  headlineHi: string;
  ctaUrl?: string;
}

interface HeroSectionProps {
  shopName: string;
  heroBanners: HeroBanner[];
}

const ASPIRATIONAL_HERO_IMAGE = '/demo-shop/campaign-necklace-showcase.jpg';
const RETIRED_HERO_IMAGE = '/demo-shop/campaign-showroom-display.jpg';

const FALLBACK_HERO = {
  imageUrl: ASPIRATIONAL_HERO_IMAGE,
  headlineHi: 'विवाह से रोजमर्रा तक - हर पल के लिए',
  ctaUrl: '/products',
};

function polishHeroBanner(banner: HeroBanner): HeroBanner {
  if (banner.imageUrl === RETIRED_HERO_IMAGE || banner.imageUrl.endsWith(RETIRED_HERO_IMAGE)) {
    return { ...banner, imageUrl: ASPIRATIONAL_HERO_IMAGE };
  }
  return banner;
}

export function HeroSection({ shopName, heroBanners }: HeroSectionProps) {
  const banners = (heroBanners.length > 0 ? heroBanners : [FALLBACK_HERO]).map(polishHeroBanner);
  const primary = banners[0]!;
  const supporting = banners.slice(1, 4);

  return (
    <section aria-labelledby="hero-heading" className="border-b border-borderSubtle bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[0.92fr_1.08fr] md:items-center md:py-12">
        <div className="max-w-xl">
          <p className="font-prose text-xs uppercase tracking-[0.22em] text-primaryDeep">
            श्रेष्ठ आभूषण
          </p>
          <h1 id="hero-heading" className="mt-3 font-heading text-4xl leading-tight text-ink md:text-6xl">
            {shopName}
          </h1>
          <p className="mt-4 max-w-md font-ui text-base leading-7 text-inkSoft md:text-lg">
            विवाह, उत्सव, उपहार और दैनिक आभूषण - सावधानी से चुना गया सोना और हीरा।
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={primary.ctaUrl ?? '/products'}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 font-ui text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              संग्रह देखें
            </Link>
            <Link
              href="/try-at-home"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-borderStrong bg-white px-6 font-ui text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              घर पर ट्राय करें
            </Link>
          </div>
        </div>

        <div className="relative min-h-[300px] overflow-hidden rounded-md bg-bg md:min-h-[440px]">
          <Image
            src={storefrontImageUrl(primary.imageUrl)}
            alt={primary.headlineHi}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 620px"
            priority
          />
        </div>
      </div>

      {supporting.length > 0 ? (
        <div className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 md:grid-cols-3">
          {supporting.map((banner) => (
            <Link
              key={`${banner.imageUrl}-${banner.headlineHi}`}
              href={banner.ctaUrl ?? '/products'}
              className="group overflow-hidden rounded-md border border-borderSubtle bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="relative bg-bg" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={storefrontImageUrl(banner.imageUrl)}
                  alt={banner.headlineHi}
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="line-clamp-2 px-3 py-3 font-ui text-sm font-semibold text-ink">
                {banner.headlineHi}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
