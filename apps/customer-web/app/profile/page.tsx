// apps/customer-web/app/profile/page.tsx
//
// Server component: resolves shopId from tenant slug then hands off to
// ProfilePageClient which handles Firebase auth gate + tabbed timeline.
// Pattern mirrors app/profile/delete-account/page.tsx.
import React from 'react';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { ProfilePageClient } from '@/components/profile/ProfilePageClient';

export const dynamic = 'force-dynamic';

interface TenantBootResponse { id: string }

async function resolveShopId(slug: string): Promise<string | null> {
  const apiBase = process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_BASE'];
  if (!apiBase) return null;
  try {
    const res = await fetch(
      `${apiBase}/api/v1/tenant/boot?slug=${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as TenantBootResponse;
    return json.id ?? null;
  } catch {
    return null;
  }
}

export default async function ProfilePage(): Promise<React.ReactElement> {
  const slug   = resolveShopSlug(headers());
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

  return <ProfilePageClient resolvedShopId={shopId} />;
}
