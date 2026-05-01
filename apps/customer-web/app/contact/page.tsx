import { headers } from 'next/headers';
import { fetchTenantConfig } from '@/lib/api';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

interface PageProps {
  searchParams: {
    interest?: string;
    product?:  string;
  };
}

const INTEREST_LABELS: Record<string, string> = {
  'try-at-home': 'घर पर आभूषण कोशिश (Try at Home)',
  'rate-lock':   'दर-लॉक बुकिंग (Rate Lock)',
};

export default async function ContactPage({ searchParams }: PageProps) {
  const slug = resolveSlug();
  const config = slug ? await fetchTenantConfig(slug) : null;

  const interestLabel = searchParams.interest
    ? (INTEREST_LABELS[searchParams.interest] ?? searchParams.interest)
    : null;

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

      {interestLabel && (
        <p className="font-body text-sm text-inkMute mb-6">
          आप <strong className="text-ink">{interestLabel}</strong> में रुचि रखते हैं।
        </p>
      )}

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
