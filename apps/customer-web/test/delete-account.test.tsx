// apps/customer-web/test/delete-account.test.tsx
//
// Story 19.7 — customer-web delete-account page tests.
// Two-stage flow: Firebase phone-OTP gate first, then deletion form.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Mock the per-app Firebase wrapper (not firebase/auth directly) ────────
// Per Semgrep rule ops/semgrep/no-firebase-client-outside-auth-client.yaml,
// the component imports OTP helpers from src/auth/firebase-customer, not
// from firebase/auth directly. Tests therefore mock that wrapper.
const mocks = vi.hoisted(() => ({
  sendOtp:               vi.fn(),
  confirmCode:           vi.fn(),
  currentUser:           null as null | { getIdToken: () => Promise<string>; uid: string },
  fetchSpy:              vi.fn(),
  pushSpy:               vi.fn(),
}));

vi.mock('../src/auth/firebase-customer', () => ({
  getCustomerAuth:         () => ({ currentUser: mocks.currentUser, signOut: vi.fn().mockResolvedValue(undefined) }),
  createInvisibleRecaptcha: () => ({ render: vi.fn(), verify: vi.fn() }),
  sendOtp:                  (...args: unknown[]) => mocks.sendOtp(...args),
}));

// Type-only `firebase/auth` import in the component is fine; provide an
// empty default mock so it doesn't try to load the real SDK in jsdom.
vi.mock('firebase/auth', () => ({}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.pushSpy, replace: mocks.pushSpy }),
}));

import { DeleteAccountPageClient } from '../app/profile/delete-account/delete-account-page-client';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser = null;
  global.fetch = mocks.fetchSpy as never;
});

describe('DeleteAccountPageClient — Firebase OTP gate', () => {
  it('renders the OTP gate first when no Firebase user is signed in', () => {
    render(<DeleteAccountPageClient resolvedShopId="dd750001-0000-4000-8000-000000000001" />);
    expect(screen.getByText(/अपना खाता हटाने के लिए पहले/)).toBeInTheDocument();
    expect(screen.getByLabelText(/मोबाइल नंबर/)).toBeInTheDocument();
    expect(screen.queryByText('क्या आप वाक़ई अपना खाता हटाना चाहते हैं?')).toBeNull();
  });

  it('after OTP confirm, switches to deletion form', async () => {
    mocks.sendOtp.mockResolvedValue({ confirm: mocks.confirmCode });
    mocks.confirmCode.mockResolvedValue({ user: { uid: 'u1', getIdToken: async () => 'token-abc' } });

    render(<DeleteAccountPageClient resolvedShopId="dd750001-0000-4000-8000-000000000001" />);
    fireEvent.change(screen.getByLabelText(/मोबाइल नंबर/), { target: { value: '+919876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /OTP भेजें/ }));

    await waitFor(() => expect(screen.getByLabelText(/OTP कोड/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/OTP कोड/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /पुष्टि करें/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /क्या आप वाक़ई/ })).toBeInTheDocument();
    });
  });
});

describe('DeleteAccountForm — after OTP success', () => {
  beforeEach(() => {
    mocks.currentUser = { getIdToken: async () => 'token-abc', uid: 'u1' };
  });

  it('renders Hindi heading and four reason options', () => {
    render(<DeleteAccountPageClient resolvedShopId="dd750001-0000-4000-8000-000000000001" />);
    expect(screen.getByRole('heading', { name: /क्या आप वाक़ई/ })).toBeInTheDocument();
    expect(screen.getByText('मुझे ज़रूरत नहीं')).toBeInTheDocument();
    expect(screen.getByText('गोपनीयता की चिंता')).toBeInTheDocument();
    expect(screen.getByText('दूसरे जौहरी से खरीद रहा')).toBeInTheDocument();
    expect(screen.getByText('अन्य')).toBeInTheDocument();
  });

  it('keeps submit disabled until both reason picked and phrase matches', async () => {
    render(<DeleteAccountPageClient resolvedShopId="dd750001-0000-4000-8000-000000000001" />);
    const submit = screen.getByRole('button', { name: /हाँ, मेरा खाता हटाएँ/ });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText('गोपनीयता की चिंता'));
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/पुष्टि के लिए/), { target: { value: 'मेरा डेटा' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/पुष्टि के लिए/), { target: { value: 'मेरा डेटा मिटाएँ' } });
    expect(submit).toBeEnabled();
  });

  it('on submit, calls fetch with Authorization + X-Tenant-Id headers and body', async () => {
    mocks.fetchSpy.mockResolvedValue({
      status: 202,
      json:   async () => ({ scheduledAt: 'x', hardDeleteAt: 'y' }),
    });

    render(<DeleteAccountPageClient resolvedShopId="dd750001-0000-4000-8000-000000000001" />);
    fireEvent.click(screen.getByLabelText('मुझे ज़रूरत नहीं'));
    fireEvent.change(screen.getByLabelText(/पुष्टि के लिए/), { target: { value: 'मेरा डेटा मिटाएँ' } });
    fireEvent.click(screen.getByRole('button', { name: /हाँ, मेरा खाता हटाएँ/ }));

    await waitFor(() => expect(mocks.fetchSpy).toHaveBeenCalledOnce());

    const [url, opts] = mocks.fetchSpy.mock.calls[0]!;
    expect(url).toMatch(/\/api\/v1\/crm\/customer\/me$/);
    expect(opts.method).toBe('DELETE');
    expect(opts.headers.Authorization).toBe('Bearer token-abc');
    expect(opts.headers['X-Tenant-Id']).toBe('dd750001-0000-4000-8000-000000000001');
    // JSON.stringify omits keys whose value is `undefined`, so after round-trip
    // the parsed body has only `reason`. The component MUST not send reasonText
    // unless explicitly set (the 'other' branch is covered by a separate test).
    expect(JSON.parse(opts.body)).toEqual({ reason: 'no-need' });

    await waitFor(() => expect(mocks.pushSpy).toHaveBeenCalledWith('/profile/delete-account/done'));
  });
});
