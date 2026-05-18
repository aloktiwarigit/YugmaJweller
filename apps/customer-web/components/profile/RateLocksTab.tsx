// apps/customer-web/components/profile/RateLocksTab.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchCustomerRateLocks,
  type CustomerRateLockItem,
} from '../../lib/api';

function paiseToRupees(paise: string): string {
  return `₹${(parseInt(paise, 10) / 100).toLocaleString('hi-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function ratePerGram(paise: string): string {
  return `₹${Math.round(parseInt(paise, 10) / 100).toLocaleString('hi-IN')}/ग्राम`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'भुगतान बाकी',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग हुआ',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
  FULFILLED:       'पूर्ण हुआ',
};

function statusClass(status: string): string {
  if (status === 'ACTIVE')  return 'bg-green-100 text-green-700';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

interface Props { shopId: string; idToken: string }

export function RateLocksTab({ shopId, idToken }: Props): JSX.Element {
  const [items,   setItems]   = useState<CustomerRateLockItem[] | null>(null);
  const [error,   setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchCustomerRateLocks(shopId, idToken)
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
          अभी तक कोई रेट-लॉक बुकिंग नहीं।
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="रेट-लॉक बुकिंग">
      {(items ?? []).map((bk) => (
        <li
          key={bk.id}
          className="rounded-lg border border-borderSubtle bg-white p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-heading text-base text-ink">
                {ratePerGram(bk.lockedRate24kPaisePerGram)}
              </p>
              <p className="font-prose text-xs text-inkMute mt-0.5">
                लॉक: {formatDate(bk.lockedAt)} · समाप्ति: {formatDate(bk.expiresAt)}
              </p>
              <p className="font-prose text-xs text-inkMute">
                जमा: {paiseToRupees(bk.depositAmountPaise)}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 font-prose text-xs ${statusClass(bk.status)}`}>
              {STATUS_LABEL[bk.status] ?? bk.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
