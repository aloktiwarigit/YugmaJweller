// apps/customer-web/test/wishlist-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

const SHOP_ID = '00000000-0000-4000-8000-000000000001';
const PROD_ID = '11111111-1111-4000-8000-000000000001';

// ── Firebase auth mock ─────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: () => Promise<string>; uid: string },
  authChangedCallback: null as ((user: unknown) => void) | null,
  getCustomerIdToken: vi.fn<[], Promise<string | null>>(),
  onCustomerAuthChanged: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('../src/auth/firebase-customer', () => ({
  getCustomerIdToken:    () => mocks.getCustomerIdToken(),
  onCustomerAuthChanged: (cb: (user: unknown) => void) => {
    mocks.authChangedCallback = cb;
    mocks.onCustomerAuthChanged(cb);
    return () => { mocks.authChangedCallback = null; };
  },
}));

vi.mock('firebase/auth', () => ({}));

// ── TenantContext mock ─────────────────────────────────────────────────────
vi.mock('../app/TenantContext', () => ({
  useTenant: () => ({ shopId: SHOP_ID, primaryColor: '#000', logoUrl: null, appName: 'Test', defaultLanguage: 'hi' }),
}));

// ── API mock ───────────────────────────────────────────────────────────────
vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...real,
    getWishlist:        vi.fn().mockResolvedValue([]),
    addToWishlist:      vi.fn().mockResolvedValue(true),
    removeFromWishlist: vi.fn().mockResolvedValue(true),
  };
});

import { WishlistButton } from '../components/WishlistButton';
import * as apiModule from '../lib/api';

function signIn() {
  act(() => {
    mocks.authChangedCallback?.({ uid: 'u1', getIdToken: async () => 'tok' });
  });
}

function signOut() {
  act(() => { mocks.authChangedCallback?.(null); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authChangedCallback = null;
  mocks.getCustomerIdToken.mockResolvedValue('firebase-token-xyz');
  vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
  vi.mocked(apiModule.addToWishlist).mockResolvedValue(true);
  vi.mocked(apiModule.removeFromWishlist).mockResolvedValue(true);
});

describe('WishlistButton — unauthenticated', () => {
  it('renders heart button', () => {
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    expect(screen.getByRole('button', { name: /इच्छा सूची में जोड़ें/ })).toBeInTheDocument();
  });

  it('shows sign-in prompt when clicked while unauthed', async () => {
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signOut();
    fireEvent.click(screen.getByRole('button', { name: /इच्छा सूची में जोड़ें/ }));
    await waitFor(() => {
      expect(screen.getByText(/इच्छा सूची सहेजने के लिए साइन इन करें/)).toBeInTheDocument();
    });
  });

  it('does NOT call the API when unauthed', async () => {
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signOut();
    fireEvent.click(screen.getByRole('button', { name: /इच्छा सूची में जोड़ें/ }));
    expect(apiModule.addToWishlist).not.toHaveBeenCalled();
  });
});

describe('WishlistButton — authenticated, not wishlisted', () => {
  it('shows unfilled heart when product is not in wishlist', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signIn();
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('optimistically fills heart on click, calls addToWishlist', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
    vi.mocked(apiModule.addToWishlist).mockResolvedValue(true);
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signIn();
    await waitFor(() => screen.getByRole('button'));

    fireEvent.click(screen.getByRole('button'));

    // Optimistic: aria-pressed flips immediately
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() =>
      expect(apiModule.addToWishlist).toHaveBeenCalledWith(PROD_ID, 'firebase-token-xyz', SHOP_ID),
    );
  });

  it('rolls back optimistic state on API failure', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
    vi.mocked(apiModule.addToWishlist).mockResolvedValue(false);
    render(<WishlistButton productId={PROD_ID} productName="22K หार" />);
    signIn();
    await waitFor(() => screen.getByRole('button'));

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      // Rolled back to unfilled
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('shows Hindi error message on API failure', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([]);
    vi.mocked(apiModule.addToWishlist).mockResolvedValue(false);
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signIn();
    await waitFor(() => screen.getByRole('button'));

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('इच्छा सूची में जोड़ नहीं पाए');
    });
  });
});

describe('WishlistButton — authenticated, wishlisted', () => {
  it('shows filled heart when product IS in wishlist', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([
      { productId: PROD_ID, sku: 'X', purity: 'GOLD_22K', metal: 'GOLD', grossWeightG: '10.000', netWeightG: '9.500', huid: null, addedAt: '2026-05-18T00:00:00Z' },
    ]);
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signIn();
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('optimistically removes heart on click, calls removeFromWishlist', async () => {
    vi.mocked(apiModule.getWishlist).mockResolvedValue([
      { productId: PROD_ID, sku: 'X', purity: 'GOLD_22K', metal: 'GOLD', grossWeightG: '10.000', netWeightG: '9.500', huid: null, addedAt: '2026-05-18T00:00:00Z' },
    ]);
    vi.mocked(apiModule.removeFromWishlist).mockResolvedValue(true);
    render(<WishlistButton productId={PROD_ID} productName="22K हार" />);
    signIn();
    await waitFor(() => screen.getByRole('button'));

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    await waitFor(() =>
      expect(apiModule.removeFromWishlist).toHaveBeenCalledWith(PROD_ID, 'firebase-token-xyz', SHOP_ID),
    );
  });
});
