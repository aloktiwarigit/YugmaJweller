import { useCustomerSessionStore, type Customer } from '../stores/customerSessionStore';
import { clearSecureSession } from '../lib/secure-storage';

export interface UseCustomerSessionReturn {
  customer: Customer | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

export function useCustomerSession(): UseCustomerSessionReturn {
  const customer = useCustomerSessionStore((s) => s.customer);
  const bearer = useCustomerSessionStore((s) => s.bearer);
  const clear = useCustomerSessionStore((s) => s.clear);

  const signOut = async (): Promise<void> => {
    clear();
    await clearSecureSession();
  };

  return {
    customer,
    isAuthenticated: customer !== null && bearer !== null,
    signOut,
  };
}
