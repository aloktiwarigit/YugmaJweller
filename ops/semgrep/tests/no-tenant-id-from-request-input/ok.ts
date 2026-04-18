import { tenantContext } from '@goldsmith/tenant-context';
export function ok() { return tenantContext.requireCurrent().shopId; }
