import { notFound } from 'next/navigation';

const GUIDES = {
  gold: {
    title: 'सोना खरीदने की गाइड',
    intro: 'शुद्धता, HUID, वजन और मेकिंग चार्ज समझकर सोने के आभूषण चुनें।',
    sections: [
      {
        title: 'शुद्धता देखें',
        body: '24K सोना सबसे शुद्ध होता है, लेकिन रोज पहनने के आभूषणों में 22K और 18K अधिक उपयोगी हो सकते हैं।',
      },
      {
        title: 'HUID और BIS',
        body: 'हॉलमार्क आभूषण पर HUID नंबर भरोसे का संकेत है। खरीदारी से पहले HUID और बिल की जानकारी मिलाएं।',
      },
      {
        title: 'वजन और मेकिंग',
        body: 'कुल वजन, शुद्ध वजन, वेस्टेज और मेकिंग चार्ज को अलग-अलग समझना अंतिम कीमत समझने में मदद करता है।',
      },
    ],
  },
  diamond: {
    title: 'डायमंड खरीदने की गाइड',
    intro: 'डायमंड चुनते समय कट, रंग, स्पष्टता, कैरेट और प्रमाणन पर ध्यान दें।',
    sections: [
      {
        title: '4C समझें',
        body: 'कट, कलर, क्लैरिटी और कैरेट डायमंड की चमक और मूल्य पर सबसे ज्यादा असर डालते हैं।',
      },
      {
        title: 'प्रमाणन पूछें',
        body: 'प्रमाणित डायमंड में ग्रेडिंग साफ होती है, जिससे तुलना और भविष्य की सेवा आसान रहती है।',
      },
      {
        title: 'सेटिंग और उपयोग',
        body: 'रोज पहनने के लिए मजबूत सेटिंग और कम उभरा डिजाइन बेहतर रहता है। शादी या समारोह के लिए बड़ा स्टेटमेंट डिजाइन चुना जा सकता है।',
      },
    ],
  },
  silver: {
    title: 'चांदी खरीदने की गाइड',
    intro: '925 स्टर्लिंग और 999 चांदी का उपयोग, देखभाल और पहचान समझें।',
    sections: [
      {
        title: '925 और 999',
        body: '925 स्टर्लिंग चांदी आभूषणों के लिए टिकाऊ होती है। 999 चांदी ज्यादा शुद्ध होती है और पूजा/निवेश वस्तुओं में सामान्य है।',
      },
      {
        title: 'देखभाल',
        body: 'चांदी को नमी, परफ्यूम और रसायनों से बचाकर रखें। मुलायम कपड़े से सफाई करें।',
      },
      {
        title: 'बिल और वजन',
        body: 'खरीदारी के समय वजन, शुद्धता और मेकिंग की जानकारी बिल में साफ होनी चाहिए।',
      },
    ],
  },
} as const;

interface PageProps {
  params: { metal: string };
}

export function generateStaticParams() {
  return Object.keys(GUIDES).map((metal) => ({ metal }));
}

export default function BuyingGuidePage({ params }: PageProps) {
  const guide = GUIDES[params.metal as keyof typeof GUIDES];
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <a
        href="/products"
        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        उत्पाद देखें
      </a>

      <h1 className="font-heading text-3xl text-ink">{guide.title}</h1>
      <p className="mt-3 font-body text-base leading-relaxed text-inkMute">{guide.intro}</p>

      <div className="mt-6 flex flex-col gap-4">
        {guide.sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-border bg-white p-5">
            <h2 className="font-body text-lg font-semibold text-ink">{section.title}</h2>
            <p className="mt-2 font-body text-base leading-relaxed text-inkMute">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
