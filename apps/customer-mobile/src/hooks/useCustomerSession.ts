import auth from '@react-native-firebase/auth';
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
    // Sign out from Firebase so the SDK clears its cached ID token and
    // onAuthStateChanged fires with null, preventing silent re-hydration on restart.
    try {
      await auth().signOut();
    } catch {
      // Firebase sign-out is best-effort — always clear local state regardless.
    }
    clear();
    await clearSecureSession();
  };

  return {
    customer,
    isAuthenticated: customer !== null && bearer !== null,
    signOut,
  };
}
