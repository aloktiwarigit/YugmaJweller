// apps/customer-web/test/wishlist-page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

const SHOP_ID = '00000000-0000-4000-8000-000000000001';
const PROD_A  = '11111111-1111-4000-8000-000000000001';
const PROD_B  = '22222222-2222-4000-8000-000000000002';

const mocks = vi.hoisted(() => ({
  authChangedCallback: null as ((user: unknown) => void) | null,
  getCustomerIdToken: vi.fn<[], Promise<string | null>>(),
}));

vi.mock('../src/auth/firebase-customer', () => ({
  getCustomerIdToken:    () => mocks.getCustomerIdToken(),
  onCustomerAuthChanged: (cb: (user: unknown) => void) => {
    mocks.authChangedCallback = cb;
    return () => { mocks.authChangedCallback = null; };
  },
}));

vi.mock('firebase/auth', () => ({}));

vi.mock('../app/TenantContext', () => ({
  useTenant: () => ({
    shopId: SHOP_ID, primaryColor: '#000', logoUrl: null, appName: 'Test', defaultLanguage: 'hi',
  }),
}));

vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...real,
    getWishlist:        vi.fn().mockResolvedValue([]),
    removeFromWishlist: vi.fn().mockResolvedValue(true),
  };
});

// Mock next/link so it renders as a plain anchor in jsdom
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

// Mock @/lib/theme so purityLabel / metalLabel work without full monorepo deps
vi.mock('../lib/theme', () => ({
  purityLabel: (purity: string) => purity,
  metalLabel:  (metal: string)  => metal,
}));

import WishlistPage from '../app/wishlist/page';
import * as apiModule from '../lib/api';

function makeItem(productId: string, sku: string) {
  return {
    productId,
    sku,
    purity: 'GOLD_22K',
    metal: 'GOLD',
    grossWeightG: '10.000',
    netWeightG: '9.500',
    huid: null,
    addedAt: '2026-05-18T10:00:00.000Z',
  };
}

function signIn() {
  act(() => { mocks.authChangedCallback?.({ uid: 'u1' }); });
}

function signOut() {
  act(() => { mocks.authChangedCallback?.(null); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authChangedCallback = null;
  mocks.getCustomerIdToken.mockResolvedValue('tok');
  vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
});

describe('WishlistPage — unauthenticated', () => {
  it('shows sign-in prompt when user is not signed in', async () => {
    render(<WishlistPage />);
    signOut();
    await waitFor(() => {
      // The page renders a sign-in link; use getAllByText since the surrounding
      // paragraph also contains the substring.
      const matches = screen.getAllByText(/साइन इन करें/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('does not call getWishlist when unauthed', async () => {
    render(<WishlistPage />);
    signOut();
    await new Promise((r) => setTimeout(r, 50));
    expect(apiModule.getWishlist).not.toHaveBeenCalled();
  });
});

describe('WishlistPage — authenticated', () => {
  it('shows empty state in Hindi when wishlist is empty', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
    render(<WishlistPage />);
    signIn();
    await waitFor(() => {
      expect(screen.getByText(/आपकी इच्छा सूची खाली है/)).toBeInTheDocument();
    });
  });

  it('renders wishlist items with sku', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([
      makeItem(PROD_A, 'GLD-001'),
      makeItem(PROD_B, 'GLD-002'),
    ]);
    render(<WishlistPage />);
    signIn();
    await waitFor(() => {
      expect(screen.getByText('GLD-001')).toBeInTheDocument();
      expect(screen.getByText('GLD-002')).toBeInTheDocument();
    });
  });

  it('removes item from list when remove button clicked', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([makeItem(PROD_A, 'GLD-001')]);
    vi.mocked(apiModule.removeFromWishlist).mockResolvedValue(true);
    render(<WishlistPage />);
    signIn();
    await waitFor(() => screen.getByText('GLD-001'));

    const removeBtn = screen.getByRole('button', { name: /हटाएं/ });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(apiModule.removeFromWishlist).toHaveBeenCalledWith(PROD_A, 'tok', SHOP_ID);
      expect(screen.queryByText('GLD-001')).toBeNull();
    });
  });

  it('calls getWishlist with idToken and shopId', async () => {
    render(<WishlistPage />);
    signIn();
    await waitFor(() => {
      expect(apiModule.getWishlist).toHaveBeenCalledWith('tok', SHOP_ID);
    });
  });
});
