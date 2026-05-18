// apps/customer-web/app/profile/delete-account/page.tsx
import React from 'react';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { DeleteAccountPageClient } from './delete-account-page-client';

export const dynamic = 'force-dynamic';

interface TenantBootResponse { id: string }

async function resolveShopId(slug: string): Promise<string | null> {
  const apiBase = process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_BASE'];
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/api/v1/tenant/boot?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TenantBootResponse;
    return json.id ?? null;
  } catch {
    return null;
  }
}

export default async function DeleteAccountPage(): Promise<React.ReactElement> {
  // Resolve slug via the shared helper so x-shop-slug header + localhost
  // fallback work the same as the rest of customer-web. Without this, a
  // header-routed multi-tenant deployment would resolve to the env-fixed
  // tenant and a same-phone customer could delete the wrong shop's row.
  const slug = resolveShopSlug(headers());
  const shopId = slug ? await resolveShopId(slug) : null;
  if (!shopId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl text-ink">अनुपलब्ध</h1>
        <p className="mt-3 text-sm text-inkMute">
          अभी यह पेज लोड नहीं हो सका। कृपया बाद में प्रयास करें।
        </p>
      </main>
    );
  }
  return <DeleteAccountPageClient resolvedShopId={shopId} />;
}
