import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/authStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_HINDI: Record<string, string> = {
  shop_admin: 'मालिक',
  shop_manager: 'प्रबंधक',
  shop_staff: 'स्टाफ़',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AccountScreen(): React.ReactElement {
  const phone = useAuthStore((s) => s.firebaseUser?.phoneNumber ?? null);
  const role = useAuthStore((s) => s.user?.role ?? '');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogoutAll = async (): Promise<void> => {
    setLoading(true);
    try {
      await api.post('/auth/logout/all');
      useAuthStore.getState().reset();
      router.replace('/(auth)/phone');
    } catch {
      Alert.alert('त्रुटि', 'Logout सफल नहीं हुआ। फिर से कोशिश करें।');
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = (): void => {
    Alert.alert(
      'सभी devices से logout करें?',
      'आपके सभी devices से logout हो जाएगा',
      [
        { text: 'रद्द करें', style: 'cancel' },
        { text: 'logout करें', style: 'destructive', onPress: () => void handleLogoutAll() },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile section */}
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>खाता जानकारी</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>फ़ोन नंबर</Text>
            <Text style={styles.profileValue} testID="account-phone">
              {phone ?? '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>भूमिका</Text>
            <View style={styles.roleBadge} testID="account-role-badge">
              <Text style={styles.roleText}>{ROLE_HINDI[role] ?? role}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout all section */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          testID="logout-all-button"
          style={[styles.logoutButton, loading && styles.logoutButtonDisabled]}
          onPress={confirmLogout}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="सभी devices से logout करें"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="logout-loading" />
          ) : (
            <Text style={styles.logoutText}>सभी devices से logout करें</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.logoutHint}>
          यह आपको सभी devices और sessions से logout कर देगा।
        </Text>
      </View>
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

  // Profile section
  profileSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.headingMid.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  profileLabel: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
  },
  profileValue: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },

  // Role badge
  roleBadge: {
    backgroundColor: '#EDE3CC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Logout section
  logoutSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutHint: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.inkMute,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
