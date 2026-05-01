import type { Tenant } from '../src/stores/tenantStore';
import type { Customer } from '../src/stores/customerSessionStore';

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'anchor-dev',
    displayName: 'अयोध्या स्वर्णकार',
    branding: {
      primaryColor: '#8C2A1E',
      logoUrl: undefined,
      appName: 'अयोध्या स्वर्णकार',
      defaultLanguage: 'hi-IN',
    },
    ...overrides,
  };
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    shopId: '00000000-0000-4000-8000-000000000001',
    name: 'देव-मोड ग्राहक',
    phoneE164: '+919999999999',
    ...overrides,
  };
}
