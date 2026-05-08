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

export function HeroSection({ shopName, heroBanners }: HeroSectionProps) {
  const hasBanners = heroBanners.length > 0;

  return (
    <section
      aria-labelledby="hero-heading"
      className="w-full bg-bg"
    >
      {/* Desktop: asymmetric 1.02fr / 0.98fr split */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: '1.02fr 0.98fr', minHeight: 480 }}>
        {/* Left: editorial card */}
        <div className="flex flex-col justify-center gap-6 px-12 py-14 bg-surfaceElevated border-r border-borderSubtle">
          <p
            className="font-prose italic text-sm text-inkSoft tracking-widest uppercase"
            aria-hidden="true"
          >
            श्रेष्ठ आभूषण
          </p>
          <h1
            id="hero-heading"
            className="font-heading text-5xl text-ink leading-tight"
          >
            {shopName}
          </h1>
          <p className="font-ui text-lg text-inkMute max-w-xs">
            विश्वसनीय सेवा, हर अवसर के लिए
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link
              href="/products"
              className="inline-block bg-primary text-white font-ui font-semibold text-sm px-6 py-3 rounded-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
            >
              संग्रह देखें
            </Link>
            <Link
              href="/products?style=DAILY_WEAR"
              className="inline-block border border-borderStrong text-ink font-ui font-semibold text-sm px-6 py-3 rounded-md hover:bg-surfaceRecessed focus-visible:outline-2 focus-visible:outline-primary transition-colors"
            >
              घर पर ट्राय करें
            </Link>
          </div>
        </div>

        {/* Right: 2×2 image mosaic */}
        <div className="grid grid-cols-2 grid-rows-2 gap-1 bg-surfaceRecessed">
          {hasBanners
            ? heroBanners.slice(0, 4).map((b, i) => (
                <div key={i} className="relative overflow-hidden">
                  <Image
                    src={b.imageUrl}
                    alt={b.headlineHi}
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primaryWash flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="font-heading text-4xl text-primary/30">आ</span>
                </div>
              ))}
        </div>
      </div>

      {/* Mobile: full-bleed editorial with text overlay */}
      <div className="md:hidden relative" style={{ aspectRatio: '4/5' }}>
        {hasBanners ? (
          <Image
            src={heroBanners[0]!.imageUrl}
            alt={heroBanners[0]!.headlineHi}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-primaryWash flex items-center justify-center">
            <span className="font-heading text-7xl text-primary/20">आ</span>
          </div>
        )}
        {/* Cream scrim + text overlay bottom-left */}
        <div
          className="absolute inset-x-0 bottom-0 px-6 pb-8 pt-24"
          style={{ background: 'linear-gradient(to top, rgba(245,237,221,0.95) 0%, transparent 100%)' }}
        >
          <h1 id="hero-heading" className="font-heading text-3xl text-ink mb-4">
            {shopName}
          </h1>
          <div className="flex flex-col gap-2">
            <Link
              href="/products"
              className="inline-block bg-primary text-white font-ui font-semibold text-sm px-5 py-3 rounded-md text-center"
            >
              उत्पाद देखें
            </Link>
            <Link
              href="/products?style=DAILY_WEAR"
              className="inline-block border border-borderStrong text-ink font-ui font-semibold text-sm px-5 py-3 rounded-md text-center bg-surface/80"
            >
              घर पर ट्राय करें
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
