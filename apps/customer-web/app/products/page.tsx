import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProducts } from '@/lib/api';
import { ProductGrid } from '@/components/ProductGrid';
import { CategorySidebar } from '@/components/CategorySidebar';
import { MetalFilterChips } from '@/components/browse/MetalFilterChips';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

interface PageProps {
  searchParams: {
    page?:       string;
    search?:     string;
    metal?:      string;
    categoryId?: string;
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const slug = resolveSlug();
  if (!slug) {
    return <p className="p-8 font-body text-inkMute text-center">दुकान नहीं मिली।</p>;
  }

  const config = await fetchTenantConfig(slug);
  if (!config) {
    return <p className="p-8 font-body text-inkMute text-center">दुकान उपलब्ध नहीं है।</p>;
  }

  const page       = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const search     = searchParams.search?.trim();
  const metal      = searchParams.metal;
  const categoryId = searchParams.categoryId;

  const productsData = await fetchProducts(config.shopId, {
    categoryId,
    search,
    page,
    limit: 12,
  });

  const items    = productsData?.items ?? [];
  const total    = productsData?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / 12));

  function buildHref(overrides: { page?: number; search?: string; metal?: string }) {
    const params = new URLSearchParams();
    const p = overrides.page ?? page;
    const s = overrides.search ?? search;
    const m = overrides.metal ?? metal;
    if (p > 1) params.set('page', String(p));
    if (s)     params.set('search', s);
    if (m)     params.set('metal', m);
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ''}`;
  }

  const chipExtras: Record<string, string> = {};
  if (search) chipExtras['search'] = search;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-ink mb-4">आभूषण संग्रह</h1>

      {/* Mobile horizontal metal filter chips */}
      <div className="mb-4">
        <MetalFilterChips selected={metal ?? ''} baseHref="/products" extraParams={chipExtras} />
      </div>

      <div className="flex gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:block w-40 shrink-0" aria-label="फ़िल्टर">
          <CategorySidebar selectedMetal={metal ?? ''} baseHref="/products" />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Search form */}
          <form role="search" aria-label="उत्पाद खोजें" method="get" action="/products" className="flex gap-2">
            {metal && <input type="hidden" name="metal" value={metal} />}
            <label htmlFor="product-search" className="sr-only">उत्पाद खोज</label>
            <input
              id="product-search"
              type="search"
              name="search"
              defaultValue={search}
              placeholder="SKU, धातु, शुद्धता खोजें..."
              className="flex-1 rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink placeholder:text-inkMute focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 font-body text-sm text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              खोजें
            </button>
          </form>

          {/* Active filter pill */}
          {metal && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-xs text-inkMute">फ़िल्टर:</span>
              <a
                href={buildHref({ metal: '' })}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary font-body text-xs px-3 py-1 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={`${metal === 'GOLD' ? 'सोना' : metal === 'SILVER' ? 'चाँदी' : metal} फ़िल्टर हटाएं`}
              >
                {metal === 'GOLD' ? 'सोना' : metal === 'SILVER' ? 'चाँदी' : metal}
                <span aria-hidden="true"> ×</span>
              </a>
            </div>
          )}

          {/* Result count */}
          <p className="font-body text-xs text-inkMute" aria-live="polite" aria-atomic="true">
            {total} उत्पाद मिले
          </p>

          <ProductGrid products={items} />

          {/* Pagination — "Show more" style (simpler for senior UX) */}
          {lastPage > 1 && (
            <nav aria-label="पृष्ठ नेवीगेशन" className="flex justify-center items-center gap-4 mt-4">
              {page > 1 && (
                <a
                  href={buildHref({ page: page - 1 })}
                  className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="पिछला पृष्ठ"
                >
                  ← पिछला
                </a>
              )}
              <span className="font-body text-sm text-inkMute" aria-current="page">
                {page} / {lastPage}
              </span>
              {page < lastPage && (
                <a
                  href={buildHref({ page: page + 1 })}
                  className="rounded-md bg-primary/10 text-primary font-body text-sm px-5 py-2 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="और उत्पाद देखें"
                >
                  और देखें →
                </a>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
