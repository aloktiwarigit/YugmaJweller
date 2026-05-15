import { notFound } from 'next/navigation';
import { fetchTenantConfig } from '@/lib/api';
import { tenantFaqMarkdown } from '@/lib/storefront';

const DEFAULT_FAQS = [
  {
    id: 'huid',
    question: 'HUID क्या होता है?',
    answer:
      'HUID हॉलमार्क आभूषण की पहचान संख्या है। योग्य सोने के आभूषणों पर HUID देखने से शुद्धता और BIS हॉलमार्क पर भरोसा बढ़ता है।',
  },
  {
    id: 'price',
    question: 'ऑनलाइन दिखा मूल्य अंतिम है?',
    answer:
      'ऑनलाइन मूल्य आज की दर, वजन, मेकिंग चार्ज और GST के आधार पर अनुमान दिखाता है। अंतिम मूल्य दुकान पर पुष्टि किया जाता है।',
  },
  {
    id: 'try-at-home',
    question: 'घर पर ट्राई कैसे काम करता है?',
    answer:
      'आप पसंद का आभूषण चुनकर घर पर ट्राई की रुचि भेज सकते हैं। दुकान उपलब्धता, समय और सुरक्षा नियमों की पुष्टि करेगी।',
  },
  {
    id: 'rate-lock',
    question: 'दर-लॉक का मतलब क्या है?',
    answer:
      'दर-लॉक में सीमित समय के लिए आज की धातु दर पर रुचि दर्ज होती है। अंतिम बुकिंग नियम दुकान की नीति के अनुसार लागू होते हैं।',
  },
] as const;

const SHOP_SLUG = process.env.NEXT_PUBLIC_SHOP_SLUG ?? null;

export default async function FaqPage() {
  if (!SHOP_SLUG) notFound();

  const config = await fetchTenantConfig(SHOP_SLUG);
  if (!config) notFound();

  const faqMarkdown = tenantFaqMarkdown(config);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-3xl text-ink">सामान्य प्रश्न</h1>
      <p className="mt-2 font-body text-sm leading-relaxed text-inkMute">
        {config.appName} से खरीदारी से पहले भरोसे, मूल्य और सेवा से जुड़े आम सवाल।
      </p>

      {faqMarkdown ? (
        <article className="mt-6 rounded-lg border border-border bg-white p-6">
          <p className="whitespace-pre-wrap font-body text-base leading-relaxed text-ink">
            {faqMarkdown}
          </p>
        </article>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav
            aria-label="FAQ सूची"
            className="h-fit rounded-lg border border-border bg-white p-4"
          >
            <h2 className="font-body text-sm font-semibold text-ink">विषय सूची</h2>
            <div className="mt-3 flex flex-col gap-2">
              {DEFAULT_FAQS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {item.question}
                </a>
              ))}
            </div>
          </nav>

          <div className="flex flex-col gap-4">
            {DEFAULT_FAQS.map((item) => (
              <section
                key={item.id}
                id={item.id}
                aria-labelledby={`${item.id}-heading`}
                className="rounded-lg border border-border bg-white p-5"
              >
                <h2 id={`${item.id}-heading`} className="font-body text-lg font-semibold text-ink">
                  {item.question}
                </h2>
                <p className="mt-2 font-body text-base leading-relaxed text-inkMute">
                  {item.answer}
                </p>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
