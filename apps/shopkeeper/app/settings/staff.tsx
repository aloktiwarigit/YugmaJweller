import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useStaffList } from '../../src/features/settings/hooks/useStaffList';
import type { StaffMember } from '../../src/features/settings/hooks/useStaffList';
import StaffInviteForm from '../../src/features/settings/components/StaffInviteForm';

export default function StaffScreen(): React.ReactElement {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (role !== undefined && role !== 'shop_admin') {
      router.replace('/');
    }
  }, [role, router]);

  const { data: staff, isLoading } = useStaffList();

  const renderItem = ({ item }: { item: StaffMember }): React.ReactElement => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.phone}>{item.phone}</Text>
        {item.invited_at !== null && (
          <Text style={styles.invitedAt}>
            {t('auth.staff.invited_at', { date: new Date(item.invited_at).toLocaleDateString('hi-IN') })}
          </Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.chip, styles.roleChip]}>
          <Text style={styles.chipText}>
            {item.role === 'shop_manager' ? t('auth.staff.role_manager') : t('auth.staff.role_staff')}
          </Text>
        </View>
        <View style={[styles.chip, item.status === 'ACTIVE' ? styles.activeChip : styles.invitedChip]}>
          <Text style={styles.chipText}>
            {item.status === 'ACTIVE' ? t('auth.staff.status_active') : t('auth.staff.status_invited')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.staff.screen_title')}</Text>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : staff && staff.length > 0 ? (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('auth.staff.empty')}</Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('auth.staff.invite_cta')}
      >
        <Text style={styles.fabText}>＋ {t('auth.staff.invite_cta')}</Text>
      </TouchableOpacity>

      {/* Bottom sheet modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setSheetOpen(false)}
          activeOpacity={1}
        />
        <View style={styles.sheet}>
          <StaffInviteForm onSuccess={() => setSheetOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.inkMute },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderColor: colors.border,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowRight: { flexDirection: 'row', gap: spacing.xs },
  phone: { fontSize: 16, color: colors.ink },
  invitedAt: { fontSize: 13, color: colors.inkMute },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 12, color: '#fff', fontWeight: '500' },
  roleChip: { backgroundColor: colors.primary },
  activeChip: { backgroundColor: '#2E7D32' },
  invitedChip: { backgroundColor: '#9E9E9E' },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.lg,
    backgroundColor: colors.primary, borderRadius: 28,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    elevation: 4,
  },
  fabText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: spacing.md,
  },
});
