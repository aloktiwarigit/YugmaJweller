import type { Customer } from '../stores/customerSessionStore';
import type { Tenant } from '../stores/tenantStore';

export const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
export const DEV_MOCK_CUSTOMER_ID = '00000000-0000-4000-8000-000000000999';
export const DEV_MOCK_CUSTOMER_NAME = 'देव-मोड ग्राहक';
export const DEV_MOCK_CUSTOMER_PHONE = '+919999999999';

export function buildDevMockBearer(): string {
  return `${DEV_MOCK_BEARER_PREFIX}${Date.now()}`;
}

export function buildDevMockCustomer(tenant: Tenant): Customer {
  return {
    id: DEV_MOCK_CUSTOMER_ID,
    shopId: tenant.id,
    name: DEV_MOCK_CUSTOMER_NAME,
    phoneE164: DEV_MOCK_CUSTOMER_PHONE,
  };
}
