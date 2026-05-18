import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/* before importing anything that uses it.
const mockUser = { getIdToken: vi.fn<[], Promise<string>>() };
const mockAuth = { currentUser: null as typeof mockUser | null };
const mockAuthChangedCb = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps:       vi.fn(() => [{}]),
}));

vi.mock('firebase/auth', () => ({
  getAuth:               vi.fn(() => mockAuth),
  signInWithPhoneNumber: vi.fn(),
  RecaptchaVerifier:     vi.fn(),
  onAuthStateChanged:    vi.fn((_auth: unknown, cb: (u: unknown) => void) => {
    mockAuthChangedCb.mockImplementation(cb);
    return vi.fn(); // unsubscribe
  }),
}));

// Import after mocks are registered
const { getCustomerIdToken, onCustomerAuthChanged } = await import('../src/auth/firebase-customer');

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.currentUser = null;
});

describe('getCustomerIdToken', () => {
  it('returns null when no currentUser', async () => {
    expect(await getCustomerIdToken()).toBeNull();
  });

  it('returns the ID token when user is signed in', async () => {
    mockUser.getIdToken.mockResolvedValue('tok-abc');
    mockAuth.currentUser = mockUser;
    expect(await getCustomerIdToken()).toBe('tok-abc');
  });

  it('returns null when getIdToken throws', async () => {
    mockUser.getIdToken.mockRejectedValue(new Error('network'));
    mockAuth.currentUser = mockUser;
    expect(await getCustomerIdToken()).toBeNull();
  });
});

describe('onCustomerAuthChanged', () => {
  it('returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = onCustomerAuthChanged(cb);
    expect(typeof unsub).toBe('function');
  });
});
