// apps/customer-web/components/profile/ProfilePageClient.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  onCustomerAuthChanged,
  type User,
} from '../../src/auth/firebase-customer';
import { PurchasesTab }  from './PurchasesTab';
import { TryAtHomeTab }  from './TryAtHomeTab';
import { RateLocksTab }  from './RateLocksTab';

type TabId = 'purchases' | 'try-at-home' | 'rate-locks' | 'wishlist';

interface TabConfig { id: TabId; label: string }

const TABS: TabConfig[] = [
  { id: 'purchases',   label: 'खरीद' },
  { id: 'try-at-home', label: 'ट्राय-एट-होम' },
  { id: 'rate-locks',  label: 'रेट-लॉक' },
  { id: 'wishlist',    label: 'इच्छा सूची' },
];

function Skeleton(): JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-pulse" aria-label="लोड हो रहा है" aria-busy="true">
      <div className="h-3 w-16 bg-border rounded mb-4" />
      <div className="h-8 w-40 bg-border rounded mb-8" />
      <div className="flex gap-4 border-b border-borderSubtle pb-2">
        {[80, 100, 80, 90].map((w, i) => <div key={i} className="h-6 bg-border rounded" style={{ width: w }} />)}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-border rounded-lg" />)}
      </div>
    </div>
  );
}

interface Props { resolvedShopId: string }

export function ProfilePageClient({ resolvedShopId }: Props): JSX.Element {
  const router = useRouter();
  // undefined = still waiting for Firebase to resolve; null = not signed in
  const [user,      setUser]      = useState<User | null | undefined>(undefined);
  const [idToken,   setIdToken]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('purchases');

  useEffect(() => {
    const unsub = onCustomerAuthChanged(async (u) => {
      if (u === null) {
        setUser(null);
        router.replace('/sign-in?returnTo=/profile');
        return;
      }
      const tok = await u.getIdToken().catch(() => null);
      setUser(u);
      setIdToken(tok);
    });
    return unsub;
  }, [router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveTab(TABS[(idx + 1) % TABS.length]!.id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveTab(TABS[(idx + TABS.length - 1) % TABS.length]!.id);
      }
    },
    [],
  );

  // Show skeleton while auth state unresolved or while getting token
  if (user === undefined || (user !== null && idToken === null)) return <Skeleton />;
  // Show skeleton while redirect in progress
  if (user === null) return <Skeleton />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <p className="font-prose text-[11px] uppercase tracking-[0.28em] text-inkMute">ग्राहक</p>
      <h1 className="mt-2 font-heading text-3xl text-ink md:text-[2.25rem]">प्रोफ़ाइल</h1>
      <p className="mt-1 text-xs text-inkMute">
        <Link
          href="/profile/delete-account"
          className="underline hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          अपना खाता हटाएँ (DPDPA)
        </Link>
      </p>

      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="प्रोफ़ाइल टैब"
        className="mt-8 flex gap-0 border-b border-borderSubtle overflow-x-auto"
      >
        {TABS.map((tab, idx) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={[
              'whitespace-nowrap px-4 py-2.5 font-prose text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-primary rounded-t-sm',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-inkMute hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="mt-6"
        >
          {activeTab === tab.id && tab.id === 'purchases'   && <PurchasesTab shopId={resolvedShopId} idToken={idToken!} />}
          {activeTab === tab.id && tab.id === 'try-at-home' && <TryAtHomeTab shopId={resolvedShopId} idToken={idToken!} />}
          {activeTab === tab.id && tab.id === 'rate-locks'  && <RateLocksTab shopId={resolvedShopId} idToken={idToken!} />}
          {activeTab === tab.id && tab.id === 'wishlist'    && (
            <div className="text-center py-12">
              <p className="font-prose text-sm text-inkMute mb-4">आपकी सहेजी हुई आभूषण सूची</p>
              <Link
                href="/wishlist"
                className="inline-block rounded-md bg-primary px-6 py-3 font-prose text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
              >
                इच्छा सूची देखें →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
