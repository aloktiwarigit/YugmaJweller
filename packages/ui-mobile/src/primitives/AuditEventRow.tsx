import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography } from '@goldsmith/ui-tokens';

export interface AuditEventRowProps {
  action: string;
  actorName: string;
  actorRole: string;
  createdAt: string; // ISO UTC string
  metadata?: Record<string, unknown>;
  testID?: string;
}

// Hindi action labels — mobile-side mapping (API is language-agnostic)
const ACTION_HINDI: Record<string, string> = {
  AUTH_VERIFY_SUCCESS: 'लॉगिन सफल',
  AUTH_VERIFY_FAILURE: 'लॉगिन असफल',
  AUTH_VERIFY_LOCKED: 'खाता बंद',
  AUTH_VERIFY_REJECTED: 'लॉगिन अस्वीकार',
  AUTH_USER_PROVISIONED: 'नया खाता बना',
  AUTH_UID_MISMATCH: 'UID मेल नहीं',
  AUTH_TOKEN_INVALID: 'टोकन अमान्य',
  AUTH_LOGOUT_ALL: 'सभी devices से logout',
  TENANT_CLAIM_CONFLICT: 'Tenant conflict',
  TENANT_BOOT: 'Tenant शुरू',
  SETTINGS_PROFILE_UPDATED: 'प्रोफ़ाइल अपडेट',
  SETTINGS_MAKING_CHARGES_UPDATED: 'बनाने का शुल्क अपडेट',
  SETTINGS_WASTAGE_UPDATED: 'घटाव अपडेट',
  SETTINGS_RATE_LOCK_UPDATED: 'रेट लॉक अपडेट',
  SETTINGS_LOYALTY_UPDATED: 'लॉयल्टी अपडेट',
  SETTINGS_TRY_AT_HOME_UPDATED: 'घर पर देखें अपडेट',
  SETTINGS_CUSTOM_ORDER_POLICY_UPDATED: 'ऑर्डर नीति अपडेट',
  SETTINGS_RETURN_POLICY_UPDATED: 'वापसी नीति अपडेट',
  SETTINGS_NOTIFICATION_PREFS_UPDATED: 'सूचना प्राथमिकताएं अपडेट',
  STAFF_INVITED: 'स्टाफ़ आमंत्रित',
  STAFF_REVOKED: 'स्टाफ़ हटाया',
  STAFF_ACTIVATED: 'स्टाफ़ सक्रिय',
  ACCESS_DENIED: 'पहुंच अस्वीकार',
  PERMISSIONS_UPDATED: 'अनुमतियां अपडेट',
};

// Hindi role labels (match ROLE_HINDI pattern from staff.tsx)
const ROLE_HINDI: Record<string, string> = {
  shop_admin: 'मालिक',
  shop_manager: 'प्रबंधक',
  shop_staff: 'स्टाफ़',
  system: 'सिस्टम',
};

// IST date formatter
const IST_FORMATTER = new Intl.DateTimeFormat('hi-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function AuditEventRow({
  action,
  actorName,
  actorRole,
  createdAt,
  testID,
}: AuditEventRowProps): React.JSX.Element {
  const label = ACTION_HINDI[action] ?? action;
  const role = ROLE_HINDI[actorRole] ?? actorRole;
  const dateStr = IST_FORMATTER.format(new Date(createdAt));

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.action}>{label}</Text>
      <Text style={styles.actor}>{actorName} · {role}</Text>
      <Text style={styles.date}>{dateStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0D5C5',
    justifyContent: 'center',
  },
  action: {
    fontSize: 16,
    fontFamily: typography.body.family,
    color: '#1A1A1A',
  },
  actor: {
    fontSize: 14,
    fontFamily: typography.body.family,
    color: '#6B6B6B',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#9B9B9B',
    marginTop: 2,
  },
});
