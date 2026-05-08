import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProducts } from '@/lib/api';
import { ProductGrid } from '@/components/ProductGrid';
import { FilterSidebar, FilterControls, type ActiveFilters } from '@/components/FilterPanel';
import type { CatalogSort } from '@goldsmith/customer-shared';
import { NoResults } from '@/components/NoResults';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

interface PageProps {
  searchParams: {
    page?:        string;
    search?:      string;
    metal?:       string;
    purity?:      string;
    priceMin?:    string;
    priceMax?:    string;
    inStockOnly?: string;
    style?:       string;
    occasion?:    string;
    giftPersona?: string;
    collection?:  string;
    sort?:        string;
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const slug = resolveSlug();
  if (!slug) return <p className="p-8 font-ui text-inkMute text-center">दुकान नहीं मिली।</p>;

  const config = await fetchTenantConfig(slug);
  if (!config) return <p className="p-8 font-ui text-inkMute text-center">दुकान उपलब्ध नहीं है।</p>;

  const page        = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const search      = searchParams.search?.trim();
  const metal       = searchParams.metal;
  const purity      = searchParams.purity;
  const priceMin    = searchParams.priceMin !== undefined ? parseInt(searchParams.priceMin, 10) : undefined;
  const priceMax    = searchParams.priceMax !== undefined ? parseInt(searchParams.priceMax, 10) : undefined;
  const inStockOnly = searchParams.inStockOnly === 'true' ? true : undefined;
  const style       = searchParams.style;
  const occasion    = searchParams.occasion;
  const giftPersona = searchParams.giftPersona;
  const collection  = searchParams.collection;
  const sort        = searchParams.sort;

  const productsData = await fetchProducts(config.shopId, {
    search, metal, purity, priceMin, priceMax, inStockOnly,
    style, occasion, giftPersona, collection, sort,
    page, limit: 12,
  });

  const items    = productsData?.items ?? [];
  const total    = productsData?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / 12));

  const activeFilters: ActiveFilters = {
    search, metal, purity, priceMin, priceMax,
    inStockOnly, style, occasion,
    sort: sort as CatalogSort | undefined,
  };

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    if (p > 1)        params.set('page', String(p));
    if (search)       params.set('search', search);
    if (metal)        params.set('metal', metal);
    if (purity)       params.set('purity', purity);
    if (priceMin)     params.set('priceMin', String(priceMin));
    if (priceMax)     params.set('priceMax', String(priceMax));
    if (inStockOnly)  params.set('inStockOnly', 'true');
    if (style)        params.set('style', style);
    if (occasion)     params.set('occasion', occasion);
    if (sort)         params.set('sort', sort);
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl md:text-3xl text-ink mb-4">आभूषण संग्रह</h1>

      {/* Search bar */}
      <form role="search" aria-label="उत्पाद खोजें" method="get" action="/products" className="mb-4 flex gap-2">
        {metal       && <input type="hidden" name="metal"       value={metal} />}
        {purity      && <input type="hidden" name="purity"      value={purity} />}
        {sort        && <input type="hidden" name="sort"        value={sort} />}
        {inStockOnly && <input type="hidden" name="inStockOnly" value="true" />}
        <label htmlFor="product-search" className="sr-only">उत्पाद खोज</label>
        <input
          id="product-search" type="search" name="search" defaultValue={search}
          placeholder="SKU, धातु, शुद्धता खोजें..."
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2 font-ui text-sm text-ink placeholder:text-inkSoft focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button type="submit"
          className="rounded-md bg-primary px-4 py-2 font-ui text-sm text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary">
          खोजें
        </button>
      </form>

      {/* Chips ribbon + mobile buttons + sort dropdown */}
      <FilterControls filters={activeFilters} totalCount={total} />

      {/* Result count */}
      <p className="mt-2 mb-3 font-ui text-xs text-inkMute" aria-live="polite" aria-atomic="true">
        {total} उत्पाद मिले
      </p>

      {/* Main two-column layout: sidebar (desktop) + products */}
      <div className="flex gap-6 items-start">
        <FilterSidebar filters={activeFilters} />

        <main className="flex-1 flex flex-col gap-4">
          {items.length === 0 ? (
            <NoResults filters={activeFilters} />
          ) : (
            <ProductGrid products={items} />
          )}

          {lastPage > 1 && items.length > 0 && (
            <nav aria-label="पृष्ठ नेवीगेशन" className="flex justify-center items-center gap-4 mt-2">
              {page > 1 && (
                <a href={buildPageHref(page - 1)}
                  className="font-ui text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="पिछला पृष्ठ">
                  ← पिछला
                </a>
              )}
              <span className="font-ui text-sm text-inkMute" aria-current="page">{page} / {lastPage}</span>
              {page < lastPage && (
                <a href={buildPageHref(page + 1)}
                  className="rounded-md bg-primary/10 text-primary font-ui text-sm px-5 py-2 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="और उत्पाद देखें">
                  और देखें →
                </a>
              )}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
