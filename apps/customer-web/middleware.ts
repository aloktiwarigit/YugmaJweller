import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest): NextResponse {
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-pathname', req.nextUrl.pathname);

  // Stamp x-shop-slug on every request so resolveShopSlug() always
  // resolves via the header path rather than env-var fallback.
  // Single-tenant deployments: NEXT_PUBLIC_SHOP_SLUG is set at deploy time.
  // Multi-tenant (future): replace this with a hostname→slug DB/edge lookup.
  const slug = process.env.NEXT_PUBLIC_SHOP_SLUG;
  if (slug) reqHeaders.set('x-shop-slug', slug);

  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
