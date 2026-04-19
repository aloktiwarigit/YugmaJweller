import { create } from 'zustand';

interface ConfirmationLike {
  confirm: (code: string) => Promise<{ user?: { getIdToken: () => Promise<string> } } | null>;
}

export interface OtpState {
  confirmation: ConfirmationLike | null;
  phoneE164: string | null;
  setConfirmation: (c: ConfirmationLike | null, phone: string | null) => void;
  clear: () => void;
}

export const useOtpStore = create<OtpState>((set) => ({
  confirmation: null,
  phoneE164: null,
  setConfirmation: (c, phone): void => set({ confirmation: c, phoneE164: phone }),
  clear: (): void => set({ confirmation: null, phoneE164: null }),
}));
