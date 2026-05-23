import { create } from 'zustand';

export interface Customer {
  id:        string;        // DB UUID (not Firebase UID)
  shopId:    string;
  name:      string;
  phoneE164: string | null; // null for OAuth users who haven't added a phone yet
  email:     string | null;
}

export interface CustomerSessionState {
  customer:   Customer | null;
  bearer:     string | null;
  isNewOAuth: boolean;      // true after first OAuth sign-up without phone — drives "Add phone" nudge
  setSession: (customer: Customer, bearer: string, isNewOAuth?: boolean) => void;
  clear:      () => void;
}

export const useCustomerSessionStore = create<CustomerSessionState>((set) => ({
  customer:   null,
  bearer:     null,
  isNewOAuth: false,
  setSession: (customer, bearer, isNewOAuth = false): void =>
    set({ customer, bearer, isNewOAuth }),
  clear: (): void => set({ customer: null, bearer: null, isNewOAuth: false }),
}));
