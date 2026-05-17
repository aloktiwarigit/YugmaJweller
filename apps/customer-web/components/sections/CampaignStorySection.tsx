import Image from 'next/image';
import Link from 'next/link';

const EDITORIAL_STORIES = [
  {
    key: 'bridal',
    eyebrow: 'विवाह उत्सव',
    title: 'विवाह कैलेंडर के लिए मुख्य आभूषण',
    body: 'भव्य सेट, समृद्ध सोने की फिनिश और मुख्य उत्सव दिनों के लिए तैयार डिज़ाइन।',
    href: '/products?collection=bridal-edit',
    image: '/demo-shop/campaign-luxe-window.jpg',
  },
  {
    key: 'daily',
    eyebrow: 'रोज़मर्रा',
    title: 'हल्का सोना, बार-बार पहनने के लिए',
    body: 'पेंडेंट, चेन, बालियाँ और कंगन — कार्यदिवस से शाम तक आसानी से।',
    href: '/products?collection=daily-gold',
    image: '/demo-shop/campaign-lifestyle-necklace.jpg',
  },
  {
    key: 'showroom',
    eyebrow: 'शोरूम झलक',
    title: 'दुकान आने से पहले संग्रह देखें',
    body: 'अवसर, धातु और उपहार के अनुसार सजाए गए सेट — पहले देखें, फिर शॉर्टलिस्ट करें।',
    href: '/collections',
    image: '/demo-shop/campaign-showroom-display.jpg',
  },
];

export function CampaignStorySection() {
  const hero = EDITORIAL_STORIES[0]!;
  const secondary = EDITORIAL_STORIES.slice(1);

  return (
    <section aria-labelledby="campaign-story-heading" className="bg-white">
      <div className="relative min-h-[430px] overflow-hidden">
        <Image
          src={hero.image}
          alt={hero.title}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/82 via-ink/42 to-transparent" />
        <div className="relative mx-auto flex min-h-[430px] max-w-6xl items-end px-4 py-10 md:items-center">
          <div className="max-w-lg">
            <p className="font-prose text-xs uppercase tracking-[0.2em] text-primary">{hero.eyebrow}</p>
            <h2 id="campaign-story-heading" className="mt-3 font-heading text-3xl leading-tight text-white md:text-5xl">
              {hero.title}
            </h2>
            <p className="mt-4 font-ui text-sm leading-7 text-white/82 md:text-base">{hero.body}</p>
            <Link
              href={hero.href}
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-ui text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              कलेक्शन देखें
            </Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        {secondary.map((story) => (
          <Link
            key={story.key}
            href={story.href}
            className="group relative min-h-[360px] overflow-hidden bg-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Image
              src={story.image}
              alt={story.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/86 via-ink/26 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <p className="font-prose text-xs uppercase tracking-[0.18em] text-primary">{story.eyebrow}</p>
              <h3 className="mt-2 font-heading text-2xl leading-tight text-white">{story.title}</h3>
              <p className="mt-3 max-w-md font-ui text-sm leading-6 text-white/78">{story.body}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
