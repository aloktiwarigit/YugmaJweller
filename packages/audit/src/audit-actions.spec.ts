import { describe, it, expect } from 'vitest';
import { AuditAction } from './audit-actions';

describe('AuditAction — backfilled values', () => {
  it.each([
    'INVENTORY_BULK_IMPORT_STARTED',
    'INVENTORY_BULK_IMPORT_COMPLETED',
    'STAFF_REVOKED',
    'STAFF_ACTIVATED',
    'ACCESS_DENIED',
    'SETTINGS_MAKING_CHARGES_UPDATED',
    'SETTINGS_WASTAGE_UPDATED',
    'SETTINGS_RATE_LOCK_UPDATED',
    'SETTINGS_LOYALTY_UPDATED',
    'SETTINGS_TRY_AT_HOME_UPDATED',
    'SETTINGS_CUSTOM_ORDER_POLICY_UPDATED',
    'SETTINGS_RETURN_POLICY_UPDATED',
    'SETTINGS_NOTIFICATION_PREFS_UPDATED',
    'AUTH_LOGOUT_ALL',
  ])('AuditAction.%s exists and equals its string key', (key) => {
    expect(AuditAction[key as keyof typeof AuditAction]).toBe(key);
  });
});
