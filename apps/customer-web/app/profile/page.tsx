export default function ProfilePage() {
  const actions = [
    {
      title: 'इच्छा सूची',
      description: 'आपके सहेजे गए आभूषण इसी ब्राउज़र में सुरक्षित रहते हैं।',
      href: '/wishlist',
    },
    {
      title: 'घर पर ट्राय',
      description: 'चुने हुए आभूषणों को घर पर देखने की जानकारी लें।',
      href: '/try-at-home',
    },
    {
      title: 'दर-लॉक',
      description: 'आज की सोने-चांदी की दर पर बुकिंग विकल्प देखें।',
      href: '/rate-lock',
    },
    {
      title: 'दुकान सहायता',
      description: 'प्रोफ़ाइल या ऑर्डर से जुड़े सवालों के लिए दुकान से बात करें।',
      href: '/contact?interest=profile',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <p className="font-prose text-[11px] uppercase tracking-[0.28em] text-inkMute">
        ग्राहक
      </p>
      <h1 className="mt-2 font-heading text-3xl text-ink md:text-[2.25rem]">
        प्रोफ़ाइल
      </h1>
      <p className="mt-3 max-w-2xl font-prose text-sm leading-relaxed text-inkMute md:text-[15px]">
        ऑनलाइन खाता सुविधा जल्द उपलब्ध होगी। अभी आप अपनी इच्छा सूची, घर पर ट्राय और दर-लॉक
        सेवाओं तक सीधे जा सकते हैं।
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {actions.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className="rounded-md border border-borderSubtle bg-surface p-5 transition-colors hover:border-primary hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
          >
            <h2 className="font-heading text-xl text-ink">{action.title}</h2>
            <p className="mt-2 font-prose text-sm leading-relaxed text-inkMute">
              {action.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
