// apps/customer-web/components/profile/PurchasesTab.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchCustomerPurchases,
  type PurchaseHistorySummary,
} from '../../lib/api';

function paiseToRupees(paise: string): string {
  return `₹${(parseInt(paise, 10) / 100).toLocaleString('hi-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  ISSUED: 'जारी',
  DRAFT:  'प्रारूप',
  VOIDED: 'रद्द',
};

interface Props { shopId: string; idToken: string }

export function PurchasesTab({ shopId, idToken }: Props): JSX.Element {
  const [items,   setItems]   = useState<PurchaseHistorySummary[] | null>(null);
  const [error,   setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchCustomerPurchases(shopId, idToken)
      .then((res) => { if (res === null) { setError(true); return; } setItems(res.invoices); })
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
        <p className="font-prose text-inkMute mb-4">
          अभी तक कोई खरीद नहीं हुई — ब्राउज़ शुरू करें
        </p>
        <Link
          href="/products"
          className="inline-block rounded-md bg-primary px-6 py-3 font-prose text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
        >
          उत्पाद देखें
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="खरीद इतिहास">
      {(items ?? []).map((inv) => (
        <li
          key={inv.invoiceId}
          className="rounded-lg border border-borderSubtle bg-white p-4 flex items-start justify-between gap-4"
        >
          <div>
            <p className="font-heading text-base text-ink">{inv.invoiceNumber}</p>
            <p className="font-prose text-xs text-inkMute mt-0.5">
              {formatDate(inv.issuedAt)} · {inv.lineCount} उत्पाद ·{' '}
              <span className="font-medium text-ink">
                {STATUS_LABEL[inv.status] ?? inv.status}
              </span>
            </p>
          </div>
          <p className="font-heading text-lg text-ink whitespace-nowrap">
            {paiseToRupees(inv.totalPaise)}
          </p>
        </li>
      ))}
    </ul>
  );
}
