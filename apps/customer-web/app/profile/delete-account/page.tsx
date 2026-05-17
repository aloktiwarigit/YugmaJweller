// apps/customer-web/app/profile/delete-account/page.tsx
import React from 'react';
import { DeleteAccountPageClient } from './delete-account-page-client';

export const dynamic = 'force-dynamic';

interface TenantBootResponse { id: string }

async function resolveShopId(): Promise<string | null> {
  const slug = process.env['NEXT_PUBLIC_SHOP_SLUG'];
  if (!slug) return null;
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
  const shopId = await resolveShopId();
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
