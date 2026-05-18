// apps/customer-web/components/profile/TryAtHomeTab.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchCustomerTryAtHomeBookings,
  type TryAtHomeBookingItem,
} from '../../lib/api';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED:         'अनुरोध किया',
  DISPATCHED:        'भेजा गया',
  RETURNED:          'वापस हुआ',
  CONVERTED_TO_SALE: 'खरीद में बदला',
};

interface Props { shopId: string; idToken: string }

export function TryAtHomeTab({ shopId, idToken }: Props): JSX.Element {
  const [items,   setItems]   = useState<TryAtHomeBookingItem[] | null>(null);
  const [error,   setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchCustomerTryAtHomeBookings(shopId, idToken)
      .then((res) => { if (res === null) { setError(true); return; } setItems(res.bookings); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shopId, idToken]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" aria-label="लोड हो रहा है">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-border rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10" role="alert">
        <p className="font-prose text-inkMute mb-4">लोड नहीं हो पाया — फिर कोशिश करें</p>
        <button
          onClick={load}
          className="rounded-md border border-borderSubtle px-4 py-2 font-prose text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
        >
          फिर कोशिश करें
        </button>
      </div>
    );
  }

  if (items !== null && items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-prose text-inkMute">
          अभी तक कोई ट्राय-एट-होम बुकिंग नहीं।
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="ट्राय-एट-होम बुकिंग">
      {(items ?? []).map((bk) => (
        <li
          key={bk.id}
          className="rounded-lg border border-borderSubtle bg-white p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-heading text-base text-ink">
                {STATUS_LABEL[bk.status] ?? bk.status}
              </p>
              <p className="font-prose text-xs text-inkMute mt-0.5">
                अनुरोध: {formatDate(bk.requestedAt)}
                {bk.dispatchAt  ? ` · भेजा: ${formatDate(bk.dispatchAt)}`   : ''}
                {bk.returnDueAt ? ` · वापसी: ${formatDate(bk.returnDueAt)}` : ''}
              </p>
            </div>
            <span className="font-prose text-xs text-inkMute whitespace-nowrap">
              {bk.productIds.length} उत्पाद
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
