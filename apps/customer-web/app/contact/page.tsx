import { fetchTenantConfig } from '@/lib/api';

// searchParams are not available in static export server components.
// The interest label derived from searchParams is cosmetic-only so we omit it
// in the static pre-render; the contact info is always correct.
export const dynamic = 'force-static';

// force-static pages cannot call headers() — use build-time env var.
// middleware.ts stamps x-shop-slug on all non-static requests; only dynamic
// pages can benefit from that header via resolveShopSlug(headers()).
const SHOP_SLUG = process.env.NEXT_PUBLIC_SHOP_SLUG ?? null;

export default async function ContactPage() {
  const config = SHOP_SLUG ? await fetchTenantConfig(SHOP_SLUG) : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <a
        href="/products"
        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="उत्पाद सूची पर वापस जाएं"
      >
        ← उत्पाद देखें
      </a>

      <h1 className="font-heading text-3xl text-ink mb-2">दुकान से संपर्क करें</h1>

      <div className="rounded-lg border border-border bg-white p-6 flex flex-col gap-4">
        <p className="font-body text-sm text-ink">
          इस सेवा के लिए दुकानदार से सीधे संपर्क करें:
        </p>

        {config && (
          <p className="font-heading text-lg text-ink">{config.appName}</p>
        )}

        <div className="flex flex-col gap-2 font-body text-sm text-ink">
          <p>📞 दुकान पर कॉल करें</p>
          <p>💬 WhatsApp पर संदेश भेजें</p>
          <p>🕐 सोमवार–शनिवार, सुबह 10 बजे से शाम 8 बजे</p>
        </div>

        <p className="font-body text-xs text-inkMute border-t border-border pt-4">
          ऑनलाइन बुकिंग सुविधा जल्द उपलब्ध होगी।
        </p>
      </div>
    </div>
  );
}
