import Image from 'next/image';
import Link from 'next/link';
import type { TenantConfigResponse } from '@/lib/api';
import {
  buildTelUrl,
  buildWhatsAppUrl,
  tenantAboutText,
  tenantAddress,
  tenantBisRegistration,
  tenantPhone,
  tenantWhatsapp,
  tenantYearsInBusiness,
} from '@/lib/storefront';

interface LegacyTrustSectionProps {
  config: TenantConfigResponse;
}

export function LegacyTrustSection({ config }: LegacyTrustSectionProps) {
  const address = tenantAddress(config);
  const phone = tenantPhone(config);
  const years = tenantYearsInBusiness(config);
  const bisRegistration = tenantBisRegistration(config);
  const aboutText =
    tenantAboutText(config) ??
    'विवाह, त्योहार, उपहार और रोजमर्रा के लिए चुने हुए सोने और हीरे के आभूषण। हर डिजाइन में शुद्धता, साफ दाम और भरोसेमंद सेवा पर ध्यान।';

  const whatsappHref = buildWhatsAppUrl(
    tenantWhatsapp(config),
    `नमस्ते ${config.appName}, मुझे आभूषणों के बारे में जानकारी चाहिए।`,
  );
  const phoneHref = buildTelUrl(phone);
  const contactHref = whatsappHref ?? phoneHref ?? '/contact';
  const contactLabel = whatsappHref ? 'WhatsApp करें' : phoneHref ? 'कॉल करें' : 'संपर्क करें';

  const facts = [
    years
      ? { value: `${years}+`, label: 'साल का भरोसा' }
      : { value: 'स्थानीय', label: 'दुकान का भरोसा' },
    { value: 'BIS', label: 'हॉलमार्क और HUID' },
    { value: 'लाइव', label: 'सोना-चांदी दरें' },
    { value: 'ट्राय', label: 'घर पर देखने की सुविधा' },
  ];

  return (
    <section aria-labelledby="legacy-trust-heading" className="border-y border-borderSubtle bg-surface py-12">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="relative min-h-[340px] overflow-hidden rounded-md bg-bg md:min-h-[440px]">
          <Image
            src="/demo-shop/campaign-showroom-display.jpg"
            alt={`${config.appName} showroom jewellery display`}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
          />
        </div>

        <div>
          <p className="font-prose text-xs uppercase tracking-[0.18em] text-primaryDeep">
            {config.appName}
          </p>
          <h2 id="legacy-trust-heading" className="mt-3 font-heading text-3xl leading-tight text-ink md:text-4xl">
            शुद्धता, सेवा और पारदर्शी खरीदारी एक ही जगह
          </h2>
          <p className="mt-4 max-w-2xl font-ui text-base leading-7 text-inkSoft">
            {aboutText}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-md border border-borderSubtle bg-bg px-4 py-3">
                <p className="font-heading text-2xl leading-none text-ink">{fact.value}</p>
                <p className="mt-2 font-ui text-xs leading-5 text-inkSoft">{fact.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 font-ui text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              संग्रह देखें
            </Link>
            <a
              href={contactHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-borderStrong bg-white px-5 font-ui text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              rel={contactHref.startsWith('http') ? 'noopener noreferrer' : undefined}
              target={contactHref.startsWith('http') ? '_blank' : undefined}
            >
              {contactLabel}
            </a>
          </div>

          {(address || phone || bisRegistration) ? (
            <dl className="mt-7 grid gap-4 border-t border-borderSubtle pt-5 font-ui text-sm sm:grid-cols-3">
              {address ? (
                <div>
                  <dt className="font-semibold text-ink">शोरूम</dt>
                  <dd className="mt-1 leading-6 text-inkSoft">{address}</dd>
                </div>
              ) : null}
              {phone ? (
                <div>
                  <dt className="font-semibold text-ink">फोन</dt>
                  <dd className="mt-1 leading-6 text-inkSoft">{phone}</dd>
                </div>
              ) : null}
              {bisRegistration ? (
                <div>
                  <dt className="font-semibold text-ink">BIS</dt>
                  <dd className="mt-1 leading-6 text-inkSoft">{bisRegistration}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
