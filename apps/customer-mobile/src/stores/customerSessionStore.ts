import { create } from 'zustand';

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phoneE164: string;
}

export interface CustomerSessionState {
  customer: Customer | null;
  bearer: string | null;
  setSession: (customer: Customer, bearer: string) => void;
  clear: () => void;
}

export const useCustomerSessionStore = create<CustomerSessionState>((set) => ({
  customer: null,
  bearer: null,
  setSession: (customer, bearer): void => set({ customer, bearer }),
  clear: (): void => set({ customer: null, bearer: null }),
}));
