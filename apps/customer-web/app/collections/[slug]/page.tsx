import { redirect } from 'next/navigation';

const COLLECTION_FILTERS: Record<string, string> = {
  bridal: '/products?style=BRIDAL',
  wedding: '/products?occasion=WEDDING',
  everyday: '/products?style=DAILY_WEAR',
  festival: '/products?occasion=FESTIVAL',
  silver: '/products?metal=SILVER',
};

export default function CollectionSlugPage({ params }: { params: { slug: string } }) {
  redirect(COLLECTION_FILTERS[params.slug] ?? '/collections');
}
