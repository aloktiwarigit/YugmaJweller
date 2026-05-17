import { vi } from 'vitest';
import auth from './firebase-auth.mock';

export { auth };

export const sendOtp = vi.fn();
export const verifyOtp = vi.fn();
export const getIdToken = vi.fn().mockResolvedValue(null);
export const normalizePhone = (value: string): string => value;
