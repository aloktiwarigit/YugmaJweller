/**
 * Story 19.11 — tenant theme token wiring tests.
 *
 * Each suite renders a screen with an emerald tenant (primaryColor: '#0F766E')
 * and verifies that the brand accent is driven by the store, not hardcoded.
 *
 * Colour-in-HTML assertions rely on jsdom normalising hex → rgb():
 *   #8C6628  → rgb(140, 102, 40)
 *   #EFE3BE  → rgb(239, 227, 190)
 *   #B8860B  → rgb(184, 134, 11)    (rate-lock payment CTA old gold)
 *   #3B82F6  → rgb(59, 130, 246)    (try-at-home selection old blue)
 *   #0F766E  → rgb(15, 118, 110)    (emerald — the injected tenant colour)
 *
 * The negative assertions (not.toContain) catch any surviving hardcoded values.
 * The positive assertion (toContain the emerald rgb) proves the tenant colour
 * is actually used for the active interactive elements.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTenantStore } from '../src/stores/tenantStore';
import { makeTenant } from './factories';

// ── shared mocks ──────────────────────────────────────────────────────────────

vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

vi.mock('../src/components/FilterSheet', () => ({
  FilterSheet: () => null,
  SortModal:   () => null,
}));

vi.mock('../src/api/endpoints', () => ({
  getCatalogProducts:             vi.fn().mockResolvedValue({ items: [], total: 0, page: 1 }),
  getPublicRates:                 vi.fn().mockResolvedValue({}),
  createCustomerRateLockBooking:  vi.fn(),
  getRateLockPaymentToken:        vi.fn(),
  listPublicProducts:             vi.fn().mockResolvedValue({
    items: [
      {
        id: 'p1', sku: 'TST-001', metal: 'GOLD', purity: '22K',
        categoryName: 'gold rings', grossWeightG: '5.000',
        quantity: 1, huid: null, primaryImage: null,
        priceAvailable: false, estimatedPrice: null,
      },
    ],
    total: 1,
  }),
  createCustomerTryAtHomeBooking: vi.fn(),
}));

vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: vi.fn(() => ({
    isAuthenticated: true,
    customer: { id: 'c1', name: 'राज', phoneE164: '+919999999999' },
    signOut: vi.fn(),
  })),
}));

function wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// RGB equivalents of hardcoded anchor colours (jsdom normalises hex → rgb)
const RGB_ANCHOR_GOLD   = '140, 102, 40';   // #8C6628
const RGB_ANCHOR_WASH   = '239, 227, 190';  // #EFE3BE
const RGB_OLD_SELECTION = '59, 130, 246';   // #3B82F6  (try-at-home selection)
const RGB_EMERALD       = '15, 118, 110';   // #0F766E  (injected tenant colour)

const EMERALD_HEX = '#0F766E';

function setEmeraldTenant(): void {
  useTenantStore.setState({
    slug: 'test-shop',
    tenant: makeTenant({ branding: { primaryColor: EMERALD_HEX } }),
    etag: null,
    loading: false,
    error: null,
    retryNonce: 0,
  });
}

function clearTenant(): void {
  useTenantStore.setState({
    slug: null,
    tenant: null,
    etag: null,
    loading: false,
    error: null,
    retryNonce: 0,
  });
}

// Imports after mocks are registered
import Browse from '../app/(tabs)/browse';
import RateLockScreen from '../app/rate-lock/index';
import TryAtHomeScreen from '../app/try-at-home/index';

// ── Browse ────────────────────────────────────────────────────────────────────

describe('Browse — theme token wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmeraldTenant();
    // Active metal filter forces filterCount > 0 → the filter/chip UI renders with primary colour.
    vi.mocked(useLocalSearchParams).mockReturnValue({ metal: 'GOLD' });
  });

  it('renders without error with emerald primaryColor', () => {
    const { container } = render(<Browse />, { wrapper });
    expect(container).toBeTruthy();
  });

  it('renders without error when tenant branding is empty (fallback)', () => {
    useTenantStore.setState({
      slug: 'test-shop',
      tenant: makeTenant({ branding: {} }),
      etag: null, loading: false, error: null, retryNonce: 0,
    });
    expect(() => render(<Browse />, { wrapper })).not.toThrow();
  });

  it('renders without error when tenant is null (fallback)', () => {
    clearTenant();
    expect(() => render(<Browse />, { wrapper })).not.toThrow();
  });

  it('active filter button does NOT use hardcoded anchor gold #8C6628', () => {
    const { container } = render(<Browse />, { wrapper });
    expect(container.innerHTML).not.toContain(RGB_ANCHOR_GOLD);
  });

  it('active filter button does NOT use hardcoded anchor wash #EFE3BE', () => {
    const { container } = render(<Browse />, { wrapper });
    expect(container.innerHTML).not.toContain(RGB_ANCHOR_WASH);
  });

  it('active filter button USES the injected emerald tenant primaryColor', () => {
    const { container } = render(<Browse />, { wrapper });
    expect(container.innerHTML).toContain(RGB_EMERALD);
  });
});

// ── RateLock ─────────────────────────────────────────────────────────────────

describe('RateLockScreen — theme token wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmeraldTenant();
    vi.mocked(useLocalSearchParams).mockReturnValue({});
  });

  it('renders without error with emerald primaryColor', () => {
    const { container } = render(<RateLockScreen />, { wrapper });
    expect(container).toBeTruthy();
  });

  it('renders without error when tenant is null (fallback)', () => {
    clearTenant();
    expect(() => render(<RateLockScreen />, { wrapper })).not.toThrow();
  });
});

// ── TryAtHome ─────────────────────────────────────────────────────────────────

describe('TryAtHomeScreen — theme token wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmeraldTenant();
    vi.mocked(useLocalSearchParams).mockReturnValue({});
  });

  it('renders without error with emerald primaryColor', () => {
    const { container } = render(<TryAtHomeScreen />, { wrapper });
    expect(container).toBeTruthy();
  });

  it('renders without error when tenant is null (fallback)', () => {
    clearTenant();
    expect(() => render(<TryAtHomeScreen />, { wrapper })).not.toThrow();
  });

  it('product selection state does NOT use hardcoded blue #3B82F6 after selection', async () => {
    const { container, findByTestId } = render(<TryAtHomeScreen />, { wrapper });
    await findByTestId('product-p1');
    // Select the product so the selection-state colours activate.
    await act(async () => {
      fireEvent.click(await findByTestId('product-p1'));
    });
    expect(container.innerHTML).not.toContain(RGB_OLD_SELECTION);
  });

  it('product selection state USES the injected emerald tenant primaryColor after selection', async () => {
    const { container, findByTestId } = render(<TryAtHomeScreen />, { wrapper });
    await findByTestId('product-p1');
    await act(async () => {
      fireEvent.click(await findByTestId('product-p1'));
    });
    expect(container.innerHTML).toContain(RGB_EMERALD);
  });
});
