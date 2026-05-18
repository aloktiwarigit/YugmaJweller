// apps/customer-web/test/profile-page.test.tsx
//
// Story 19.9 — ProfilePageClient auth gate + tab behaviour tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Mock setup ──────────────────────────────────────────────────────────────

type AuthCb = (user: MockUser | null) => void;

interface MockUser { getIdToken: () => Promise<string>; uid: string }

const mocks = vi.hoisted(() => ({
  authCb:          null as AuthCb | null,
  replaceSpy:      vi.fn(),
  fetchPurchases:  vi.fn(),
  fetchRateLocks:  vi.fn(),
  fetchTryAtHome:  vi.fn(),
}));

vi.mock('../src/auth/firebase-customer', () => ({
  onCustomerAuthChanged: (cb: AuthCb) => {
    mocks.authCb = cb;
    return () => { mocks.authCb = null; };
  },
  getCustomerAuth: () => ({ currentUser: null }),
}));

vi.mock('firebase/auth', () => ({}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replaceSpy, push: mocks.replaceSpy }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('../lib/api', () => ({
  fetchCustomerPurchases:         (...args: unknown[]) => mocks.fetchPurchases(...args),
  fetchCustomerRateLocks:         (...args: unknown[]) => mocks.fetchRateLocks(...args),
  fetchCustomerTryAtHomeBookings: (...args: unknown[]) => mocks.fetchTryAtHome(...args),
}));

import { ProfilePageClient } from '../components/profile/ProfilePageClient';

const SHOP = 'shop-uuid-0001';

function makeUser(): MockUser {
  return { getIdToken: async () => 'tok-test', uid: 'u1' };
}

async function signIn(): Promise<void> {
  await act(async () => { await mocks.authCb?.(makeUser()); });
}

async function waitForTabs(): Promise<void> {
  await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authCb = null;
  mocks.fetchPurchases.mockResolvedValue({ invoices: [], total: 0 });
  mocks.fetchRateLocks.mockResolvedValue({ bookings: [], total: 0 });
  mocks.fetchTryAtHome.mockResolvedValue({ bookings: [], total: 0 });
});

// ── Auth gate ────────────────────────────────────────────────────────────────

describe('ProfilePageClient — auth gate', () => {
  it('shows skeleton before auth state resolves (no tablist yet)', () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('redirects to /sign-in?returnTo=/profile when auth fires with null', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await act(async () => { mocks.authCb?.(null); });
    expect(mocks.replaceSpy).toHaveBeenCalledWith('/sign-in?returnTo=/profile');
  });

  it('shows tab UI after auth resolves with a user', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    expect(screen.getByRole('tab', { name: 'खरीद' })).toBeInTheDocument();
  });

  it('redirects when getIdToken rejects', async () => {
    const badUser = { getIdToken: async () => { throw new Error('token failed'); }, uid: 'u2' };
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await act(async () => { await mocks.authCb?.(badUser as MockUser); });
    expect(mocks.replaceSpy).toHaveBeenCalledWith('/sign-in?returnTo=/profile');
  });
});

// ── ARIA roles ───────────────────────────────────────────────────────────────

describe('ProfilePageClient — ARIA', () => {
  it('renders tablist, tabs, and tabpanels with correct roles', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(4);
  });

  it('active tab has aria-selected=true, others false', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    tabs.slice(1).forEach((t) => expect(t).toHaveAttribute('aria-selected', 'false'));
  });

  it('ArrowRight moves to next tab', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'खरीद' }), { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'ट्राय-एट-होम' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('ArrowLeft wraps to last tab from first', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'खरीद' }), { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'इच्छा सूची' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('Home key moves to first tab', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    // First click to ट्राय-एट-होम, then Home should jump back to खरीद
    fireEvent.click(screen.getByRole('tab', { name: 'ट्राय-एट-होम' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'ट्राय-एट-होम' })).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'ट्राय-एट-होम' }), { key: 'Home' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'खरीद' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('End key moves to last tab', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'खरीद' }), { key: 'End' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'इच्छा सूची' })).toHaveAttribute('aria-selected', 'true');
    });
  });
});

// ── Tab click switching ───────────────────────────────────────────────────────

describe('ProfilePageClient — tab click switching', () => {
  it('clicking ट्राय-एट-होम shows its panel', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: 'ट्राय-एट-होम' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'ट्राय-एट-होम' })).toHaveAttribute('aria-selected', 'true');
    });
  });
});

// ── PurchasesTab states (via ProfilePageClient) ───────────────────────────────

describe('PurchasesTab', () => {
  it('shows empty state when API returns no items', async () => {
    mocks.fetchPurchases.mockResolvedValue({ invoices: [], total: 0 });
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitFor(() => {
      expect(screen.getByText(/अभी तक कोई खरीद नहीं हुई/)).toBeInTheDocument();
    });
  });

  it('shows error state when API returns null', async () => {
    mocks.fetchPurchases.mockResolvedValue(null);
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/लोड नहीं हो पाया/)).toBeInTheDocument();
    });
  });

  it('renders invoice items when API returns data', async () => {
    mocks.fetchPurchases.mockResolvedValue({
      invoices: [{
        invoiceId: 'inv-1', invoiceNumber: 'INV-001',
        issuedAt: '2026-01-01T00:00:00Z', totalPaise: '1000000',
        status: 'ISSUED', lineCount: 2, paymentMethod: 'CASH',
      }],
      total: 1,
    });
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });
  });
});

// ── DPDPA link ────────────────────────────────────────────────────────────────

describe('ProfilePageClient — DPDPA link', () => {
  it('shows delete-account link pointing to /profile/delete-account', async () => {
    render(<ProfilePageClient resolvedShopId={SHOP} />);
    await signIn();
    await waitForTabs();
    const link = screen.getByRole('link', { name: /अपना खाता हटाएँ/ });
    expect(link).toHaveAttribute('href', '/profile/delete-account');
  });
});
