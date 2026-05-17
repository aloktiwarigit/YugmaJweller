import Image from 'next/image';
import Link from 'next/link';

interface HeroBanner {
  imageUrl: string;
  headlineHi: string;
  ctaUrl?: string;
}

interface HeroSectionProps {
  shopName: string;
  heroBanners: HeroBanner[];
}

const FALLBACK_HERO = {
  imageUrl: '/demo-shop/campaign-showroom-display.jpg',
  headlineHi: 'विवाह से रोज़मर्रा तक — हर पल के लिए',
  ctaUrl: '/products',
};

export function HeroSection({ shopName, heroBanners }: HeroSectionProps) {
  const banners = heroBanners.length > 0 ? heroBanners : [FALLBACK_HERO];
  const primary = banners[0]!;
  const supporting = banners.slice(1, 4);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative min-h-[620px] overflow-hidden bg-ink md:min-h-[560px]"
    >
      <Image
        src={primary.imageUrl}
        alt={primary.headlineHi}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/82 via-ink/42 to-ink/12" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[620px] max-w-6xl flex-col justify-end px-4 py-10 md:min-h-[560px] md:justify-center md:py-16">
        <div className="max-w-xl">
          <p className="font-prose text-xs uppercase text-primary tracking-[0.22em]">
            श्रेष्ठ आभूषण
          </p>
          <h1 id="hero-heading" className="mt-3 font-heading text-4xl leading-tight text-white md:text-6xl">
            {shopName}
          </h1>
          <p className="mt-4 max-w-md font-ui text-base leading-7 text-white/82 md:text-lg">
            विवाह, उत्सव, उपहार और दैनिक आभूषण — सावधानी से चुना गया सोना और हीरा।
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
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/55 bg-white/10 px-6 font-ui text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-primary"
            >
              घर पर ट्राय करें
            </Link>
          </div>
        </div>

        {supporting.length > 0 ? (
          <div className="mt-10 grid gap-3 md:absolute md:bottom-8 md:right-4 md:mt-0 md:w-[420px] md:grid-cols-3">
            {supporting.map((banner) => (
              <Link
                key={`${banner.imageUrl}-${banner.headlineHi}`}
                href={banner.ctaUrl ?? '/products'}
                className="group relative hidden overflow-hidden rounded-md border border-white/25 bg-white/10 md:block"
                style={{ aspectRatio: '4/5' }}
              >
                <Image
                  src={banner.imageUrl}
                  alt={banner.headlineHi}
                  fill
                  sizes="140px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-3 pt-10">
                  <p className="line-clamp-2 font-ui text-xs font-semibold text-white">{banner.headlineHi}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
