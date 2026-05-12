import type { TenantConfigResponse } from '@/lib/api';
import {
  buildTelUrl,
  buildWhatsAppUrl,
  tenantAddress,
  tenantAppDownloadUrl,
  tenantPhone,
  tenantSocialLinks,
  tenantWhatsapp,
} from '@/lib/storefront';

export function StorefrontFooter({ config }: { config: TenantConfigResponse }) {
  const address = tenantAddress(config);
  const phone = tenantPhone(config);
  const phoneHref = buildTelUrl(phone);
  const whatsappHref = buildWhatsAppUrl(
    tenantWhatsapp(config),
    `नमस्ते ${config.appName}, मुझे आभूषणों के बारे में जानकारी चाहिए।`,
  );
  const socialLinks = tenantSocialLinks(config);
  const appDownloadUrl = tenantAppDownloadUrl(config);

  return (
    <footer className="mt-12 border-t border-border bg-white" aria-label="दुकान और सहायता लिंक">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="font-heading text-xl text-ink">
            {config.appName}
          </h2>
          <div className="mt-3 flex flex-col gap-2 font-body text-sm leading-relaxed text-inkMute">
            {address ? <p>{address}</p> : <p>दुकान का पता जल्द उपलब्ध होगा।</p>}
            {phoneHref ? (
              <a className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary" href={phoneHref}>
                कॉल करें: {phone}
              </a>
            ) : (
              <a className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary" href="/contact">
                दुकान से संपर्क करें
              </a>
            )}
            {whatsappHref && (
              <a
                className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                href={whatsappHref}
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp पर संदेश भेजें
              </a>
            )}
          </div>
        </section>

        <nav aria-labelledby="footer-shop-links" className="flex flex-col gap-2 font-body text-sm">
          <h2 id="footer-shop-links" className="font-body text-sm font-semibold text-ink">
            खरीदारी
          </h2>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/products">
            सभी आभूषण
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/wishlist">
            पसंदीदा
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/try-at-home">
            घर पर ट्राई
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/rate-lock">
            दर-लॉक
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/loyalty">
            लॉयल्टी
          </a>
        </nav>

        <nav aria-labelledby="footer-help-links" className="flex flex-col gap-2 font-body text-sm">
          <h2 id="footer-help-links" className="font-body text-sm font-semibold text-ink">
            सहायता
          </h2>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/return-policy">
            वापसी / आदान-प्रदान
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/shipping-policy">
            शिपिंग नीति
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/cancellation-policy">
            कैंसिलेशन नीति
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/faq">
            सामान्य प्रश्न
          </a>
          <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/contact">
            संपर्क
          </a>
        </nav>

        <section aria-labelledby="footer-legal" className="flex flex-col gap-4 font-body text-sm">
          <div className="flex flex-col gap-2">
            <h2 id="footer-legal" className="font-body text-sm font-semibold text-ink">
              कानूनी
            </h2>
            <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/privacy">
              गोपनीयता
            </a>
            <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/terms">
              शर्तें
            </a>
            <a className="text-inkMute hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/sitemap.xml">
              साइटमैप
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-sm font-semibold text-ink">सोशल लिंक</p>
            {socialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-inkMute">सोशल लिंक जल्द उपलब्ध होंगे।</p>
            )}
          </div>

          {appDownloadUrl ? (
            <a
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-primary bg-primary/5 px-4 py-2 text-center text-primary focus-visible:outline-2 focus-visible:outline-primary"
              href={appDownloadUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              ऐप डाउनलोड करें
            </a>
          ) : (
            <p className="rounded-md border border-border bg-bg px-4 py-2 text-center text-inkMute">
              ऐप जल्द उपलब्ध होगा
            </p>
          )}
        </section>
      </div>
      <div className="border-t border-border px-4 py-4 text-center font-body text-xs text-inkMute">
        © {new Date().getFullYear()} {config.appName}. सभी अधिकार सुरक्षित।
      </div>
    </footer>
  );
}
