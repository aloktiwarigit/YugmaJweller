import Image from 'next/image';
import Link from 'next/link';

const EDITORIAL_STORIES = [
  {
    key: 'bridal',
    eyebrow: 'विवाह उत्सव',
    title: 'विवाह कैलेंडर के लिए मुख्य आभूषण',
    body: 'भव्य सेट, समृद्ध सोने की फिनिश और मुख्य उत्सव दिनों के लिए तैयार डिजाइन।',
    href: '/products?collection=bridal-edit',
    image: '/demo-shop/campaign-luxe-window.jpg',
  },
  {
    key: 'daily',
    eyebrow: 'रोजमर्रा',
    title: 'हल्का सोना, बार-बार पहनने के लिए',
    body: 'पेंडेंट, चेन, बालियां और कंगन - कार्यदिवस से शाम तक आसानी से।',
    href: '/products?collection=daily-gold',
    image: '/demo-shop/campaign-lifestyle-necklace.jpg',
  },
  {
    key: 'showroom',
    eyebrow: 'शोरूम झलक',
    title: 'दुकान आने से पहले संग्रह देखें',
    body: 'अवसर, धातु और उपहार के अनुसार सजाए गए सेट - पहले देखें, फिर शॉर्टलिस्ट करें।',
    href: '/collections',
    image: '/demo-shop/campaign-showroom-display.jpg',
  },
];

export function CampaignStorySection() {
  const hero = EDITORIAL_STORIES[0]!;
  const secondary = EDITORIAL_STORIES.slice(1);

  return (
    <section aria-labelledby="campaign-story-heading" className="bg-white py-10">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-[1.05fr_0.95fr] md:items-center">
        <div className="relative min-h-[300px] overflow-hidden rounded-md bg-bg md:min-h-[430px]">
          <Image
            src={hero.image}
            alt={hero.title}
            fill
            sizes="(max-width: 768px) 100vw, 620px"
            className="object-cover"
          />
        </div>
        <div>
          <p className="font-prose text-xs uppercase tracking-[0.2em] text-primaryDeep">{hero.eyebrow}</p>
          <h2 id="campaign-story-heading" className="mt-3 font-heading text-3xl leading-tight text-ink md:text-5xl">
            {hero.title}
          </h2>
          <p className="mt-4 max-w-lg font-ui text-sm leading-7 text-inkSoft md:text-base">{hero.body}</p>
          <Link
            href={hero.href}
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-ui text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            कलेक्शन देखें
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-5 grid max-w-6xl gap-4 px-4 md:grid-cols-2">
        {secondary.map((story) => (
          <Link
            key={story.key}
            href={story.href}
            className="group overflow-hidden rounded-md border border-borderSubtle bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="relative bg-bg" style={{ aspectRatio: '16/9' }}>
              <Image
                src={story.image}
                alt={story.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5 md:p-6">
              <p className="font-prose text-xs uppercase tracking-[0.18em] text-primaryDeep">{story.eyebrow}</p>
              <h3 className="mt-2 font-heading text-2xl leading-tight text-ink">{story.title}</h3>
              <p className="mt-3 max-w-md font-ui text-sm leading-6 text-inkSoft">{story.body}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
