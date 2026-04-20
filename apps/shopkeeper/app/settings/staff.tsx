import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { Toast } from '@goldsmith/ui-mobile';
import { StaffInviteForm } from '../../src/components/StaffInviteForm';
import { PermissionsMatrix } from '../../src/components/PermissionsMatrix';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/authStore';
import type { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffUser {
  id: string;
  displayName: string;
  phone: string;
  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
  invitedAt: string | null;
  activatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_HINDI: Record<string, string> = {
  shop_admin: 'एडमिन',
  shop_manager: 'मैनेजर',
  shop_staff: 'स्टाफ',
};

type TabId = 'list' | 'invite';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: string }): React.ReactElement {
  const label = ROLE_HINDI[role] ?? role;
  return (
    <View style={styles.roleBadge}>
      <Text style={styles.roleBadgeText}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: StaffUser['status'] }): React.ReactElement {
  const isActive = status === 'ACTIVE';
  return (
    <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeInvited]}>
      <Text style={[styles.statusBadgeText, isActive ? styles.statusTextActive : styles.statusTextInvited]}>
        {isActive ? 'सक्रिय' : 'आमंत्रित'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StaffScreen(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const shopId = user?.shopId ?? '';
  const isAdmin = user?.role === 'shop_admin';

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('list');

  // Staff list state
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Invite mutation state
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Revoke state
  const [revokeTarget, setRevokeTarget] = useState<StaffUser | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Permissions state (admin-only)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permsLoading, setPermsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch staff list
  // ---------------------------------------------------------------------------

  const fetchStaff = useCallback(async (): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await api.get<StaffUser[]>('/auth/users');
      setStaff(res.data ?? []);
    } catch {
      setListError('स्टाफ लोड नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  // ---------------------------------------------------------------------------
  // Fetch permissions (admin only)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAdmin) return;
    setPermsLoading(true);
    api
      .get<Record<string, boolean>>('/auth/roles/shop_manager/permissions')
      .then((res) => {
        setPermissions(res.data ?? {});
      })
      .catch(() => {
        // non-blocking — permissions section stays empty
      })
      .finally(() => {
        setPermsLoading(false);
      });
  }, [isAdmin]);

  // ---------------------------------------------------------------------------
  // Invite handler
  // ---------------------------------------------------------------------------

  const handleInvite = async (data: {
    phone: string;
    role: 'shop_staff' | 'shop_manager';
    display_name: string;
  }): Promise<void> => {
    setInviteLoading(true);
    setInviteError(null);
    try {
      await api.post('/auth/invite', { ...data, shop_id: shopId });
      setSuccessMsg('आमंत्रण भेज दिया गया');
      setTimeout(() => setSuccessMsg(null), 3000);
      // Invalidate staff list
      void fetchStaff();
      // Switch back to list tab
      setActiveTab('list');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      if (axiosErr.response?.status === 409) {
        setInviteError('यह नंबर पहले से जुड़ा हुआ है।');
      } else {
        setInviteError('आमंत्रण नहीं भेजा जा सका। दोबारा कोशिश करें।');
      }
    } finally {
      setInviteLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Permissions toggle handler
  // ---------------------------------------------------------------------------

  const handlePermToggle = (key: string, value: boolean): void => {
    const previous = permissions;
    const updated = { ...permissions, [key]: value };
    setPermissions(updated);
    // UpdatePermissionSchema expects { permission_key, is_enabled } — one call per toggle.
    api
      .put('/auth/roles/shop_manager/permissions', { permission_key: key, is_enabled: value })
      .catch(() => {
        // Rollback optimistic update on error
        setPermissions(previous);
        Alert.alert('त्रुटि', 'अनुमति अपडेट नहीं हो सकी।');
      });
  };

  // ---------------------------------------------------------------------------
  // Revoke handler
  // ---------------------------------------------------------------------------

  const handleRevoke = (member: StaffUser): void => {
    setRevokeTarget(member);
  };

  const confirmRevoke = async (): Promise<void> => {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeLoading(true);

    // Optimistic remove
    setStaff((prev) => prev.filter((m) => m.id !== target.id));
    setRevokeTarget(null);

    try {
      await api.delete(`/auth/staff/${target.id}`);
      setSuccessMsg('हटा दिया गया');
      setTimeout(() => setSuccessMsg(null), 3000);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      // Revert optimistic remove
      setStaff((prev) => [target, ...prev]);
      const status = (err as AxiosError).response?.status;
      if (status === 400) {
        setListError('आप स्वयं को नहीं हटा सकते');
      } else if (status === 403) {
        setListError('एडमिन को नहीं हटाया जा सकता');
      } else if (status === 404) {
        setListError('स्टाफ नहीं मिला');
      } else {
        setListError('हटाया नहीं जा सका। दोबारा कोशिश करें।');
      }
    } finally {
      setRevokeLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderStaffList = (): React.ReactElement => {
    if (listLoading) {
      return (
        <View style={styles.centeredPad}>
          <ActivityIndicator size="large" color={colors.primary} testID="staff-list-loading" />
        </View>
      );
    }
    if (listError !== null) {
      return (
        <View style={styles.centeredPad}>
          <Text style={styles.errorText}>{listError}</Text>
          <TouchableOpacity
            onPress={() => void fetchStaff()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>फिर से लोड करें</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (staff.length === 0) {
      return (
        <View style={styles.centeredPad}>
          <Text style={styles.emptyText}>अभी कोई स्टाफ नहीं</Text>
        </View>
      );
    }
    return (
      <View>
        {staff.map((member) => (
          <View
            key={member.id}
            testID={`staff-row-${member.id}`}
            style={styles.staffRow}
            accessible
            accessibilityLabel={`${member.displayName}, ${ROLE_HINDI[member.role] ?? member.role}, ${member.status === 'ACTIVE' ? 'सक्रिय' : 'आमंत्रित'}`}
          >
            <View style={styles.staffRowMain}>
              <Text style={styles.staffName}>{member.displayName}</Text>
              <Text style={styles.staffPhone}>{member.phone}</Text>
            </View>
            <View style={styles.staffRowBadges}>
              <RoleBadge role={member.role} />
              <View style={{ width: 6 }} />
              <StatusBadge status={member.status} />
              {isAdmin && member.role !== 'shop_admin' && (
                <>
                  <View style={{ width: 8 }} />
                  <TouchableOpacity
                    testID={`revoke-btn-${member.id}`}
                    style={styles.revokeButton}
                    onPress={() => handleRevoke(member)}
                    accessibilityRole="button"
                    accessibilityLabel={`${member.displayName} को हटाएं`}
                    disabled={revokeLoading}
                  >
                    <Text style={styles.revokeButtonText}>हटाएं</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderInviteTab = (): React.ReactElement => (
    <StaffInviteForm
      onSubmit={(data) => void handleInvite(data)}
      loading={inviteLoading}
      error={inviteError}
    />
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Success toast */}
      {successMsg !== null && (
        <View style={styles.toastWrapper}>
          <Toast message={successMsg} variant="info" testID="staff-success-toast" />
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="tab-staff-list"
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'list' }}
        >
          <Text style={[styles.tabLabel, activeTab === 'list' && styles.tabLabelActive]}>
            स्टाफ सूची
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-staff-invite"
          style={[styles.tab, activeTab === 'invite' && styles.tabActive]}
          onPress={() => setActiveTab('invite')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'invite' }}
        >
          <Text style={[styles.tabLabel, activeTab === 'invite' && styles.tabLabelActive]}>
            आमंत्रित करें
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'list' ? renderStaffList() : renderInviteTab()}
      </View>

      {/* Permissions section — admin only */}
      {isAdmin && (
        <View style={styles.permsSection}>
          <Text style={styles.permsSectionTitle}>मैनेजर की अनुमतियाँ</Text>
          {permsLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              testID="perms-loading"
              style={{ marginVertical: spacing.md }}
            />
          ) : (
            <PermissionsMatrix
              role="shop_manager"
              permissions={permissions}
              onToggle={handlePermToggle}
            />
          )}
        </View>
      )}

      <View style={{ height: spacing.xl }} />

      {/* Revoke confirmation modal */}
      <Modal
        visible={revokeTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { /* non-dismissable via back button */ }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {`क्या आप ${revokeTarget?.displayName ?? ''} को हटाना चाहते हैं?`}
            </Text>
            <Text style={styles.modalBody}>
              यह action वापस नहीं ली जा सकती।
            </Text>
            <TouchableOpacity
              testID="revoke-confirm-btn"
              style={styles.revokeConfirmButton}
              onPress={() => void confirmRevoke()}
              disabled={revokeLoading}
              accessibilityRole="button"
            >
              {revokeLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.revokeConfirmText}>हाँ, हटाएं</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              testID="revoke-cancel-btn"
              style={styles.revokeCancelButton}
              onPress={() => setRevokeTarget(null)}
              accessibilityRole="button"
            >
              <Text style={styles.revokeCancelText}>रद्द करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  toastWrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 10,
    backgroundColor: '#EDE3CC',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '500',
    color: colors.inkMute,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Tab content
  tabContent: {
    marginTop: spacing.sm,
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Staff list
  centeredPad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  staffRowMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  staffName: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  staffPhone: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkMute,
    marginTop: 2,
  },
  staffRowBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Role badge
  roleBadge: {
    backgroundColor: '#EDE3CC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontFamily: typography.body.family,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Status badge
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeActive: {
    backgroundColor: '#D4EDDA',
  },
  statusBadgeInvited: {
    backgroundColor: '#FFF3CD',
  },
  statusBadgeText: {
    fontFamily: typography.body.family,
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#1A6630',
  },
  statusTextInvited: {
    color: '#856404',
  },

  // Revoke button (inline in staff row)
  revokeButton: {
    backgroundColor: '#C0392B',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokeButtonText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 16,
  },
  modalTitle: {
    fontFamily: typography.headingMid.family,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: typography.body.family,
    fontSize: 15,
    color: colors.inkMute,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  revokeConfirmButton: {
    backgroundColor: '#C0392B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  revokeConfirmText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  revokeCancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  revokeCancelText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },

  // Permissions section
  permsSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  permsSectionTitle: {
    fontFamily: typography.headingMid.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
});
