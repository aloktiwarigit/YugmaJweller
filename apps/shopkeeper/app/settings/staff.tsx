import React, { useState } from 'react';
import { View, Text, FlatList, Modal, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '@goldsmith/i18n';
import { FormField } from '@goldsmith/ui-mobile';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import type { StaffListItemDto, InviteResponseDto } from '../../src/types/staff';

type InviteRole = 'shop_staff' | 'shop_manager';

interface InviteForm {
  display_name: string;
  phone: string;
  role: InviteRole;
}

export default function StaffScreen(): React.ReactElement {
  const qc = useQueryClient();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [form, setForm] = useState<InviteForm>({ display_name: '', phone: '', role: 'shop_staff' });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get<{ staff: StaffListItemDto[] }>('/api/v1/staff');
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (body: InviteForm) => {
      const res = await api.post<InviteResponseDto>('/api/v1/staff', {
        phone: `+91${body.phone}`,
        display_name: body.display_name,
        role: body.role,
      });
      return res.data;
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['staff'] });
      setSheetVisible(false);
      setForm({ display_name: '', phone: '', role: 'shop_staff' });
      await Share.share({ message: result.share.text, title: t('staff.share_subject') });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setPhoneError(t('staff.error_duplicate'));
      } else {
        setPhoneError(t('staff.error_generic'));
      }
    },
  });

  const staff = data?.staff ?? [];
  const canSubmit = form.display_name.trim().length > 0 && form.phone.length === 10 && !mutation.isPending;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('staff.screen_title')}</Text>

      {!isLoading && staff.length === 0 && (
        <Text style={styles.emptyState}>{t('staff.empty_state')}</Text>
      )}

      {staff.length > 0 && (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StaffRow item={item} />}
        />
      )}

      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setSheetVisible(true)}
          testID="staff-add-btn"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>{t('staff.add_button')}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('staff.invite_title')}</Text>

            <FormField
              label={t('staff.field_name')}
              value={form.display_name}
              onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
              testID="invite-name"
            />

            <FormField
              label={t('staff.field_phone')}
              value={form.phone}
              onChangeText={(v) => {
                setPhoneError(null);
                setForm((f) => ({ ...f, phone: v }));
              }}
              keyboardType="phone-pad"
              maxLength={10}
              error={phoneError ?? undefined}
              testID="invite-phone"
            />

            <Text style={styles.roleLabel}>{t('staff.field_role')}</Text>
            <View style={styles.roleRow}>
              {(['shop_staff', 'shop_manager'] as InviteRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setForm((f) => ({ ...f, role: r }))}
                  style={[styles.roleBtn, form.role === r && styles.roleBtnActive]}
                  accessibilityRole="radio"
                >
                  <Text style={[styles.roleBtnText, form.role === r && styles.roleBtnTextActive]}>
                    {r === 'shop_staff' ? t('staff.role_staff') : t('staff.role_manager')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={() => {
                if (canSubmit) {
                  mutation.mutate(form);
                }
              }}
              disabled={!canSubmit}
              testID="invite-submit-btn"
              accessibilityState={{ disabled: !canSubmit }}
              accessibilityRole="button"
            >
              <Text style={styles.submitBtnText}>{t('staff.submit_button')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StaffRow({ item }: { item: StaffListItemDto }): React.ReactElement {
  const statusKey = item.status.toLowerCase() as 'invited' | 'active' | 'suspended';
  const statusText = t(`staff.status_${statusKey}`);
  const pillColor =
    item.status === 'ACTIVE' ? colors.primary : item.status === 'INVITED' ? '#C49A3C' : colors.error;

  return (
    <View style={styles.staffRow}>
      <View>
        <Text style={styles.staffName}>{item.display_name}</Text>
        <Text style={styles.staffMeta}>
          {item.role === 'shop_manager' ? t('staff.role_manager') : t('staff.role_staff')} ·{' '}
          {'•••• ' + item.phone_last4}
        </Text>
      </View>
      <View
        style={[
          styles.statusPill,
          { borderColor: pillColor, backgroundColor: pillColor + '22' },
        ]}
      >
        <Text style={[styles.statusText, { color: pillColor }]}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontFamily: typography.body.family,
    fontSize: 20,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  emptyState: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
  },
  addButton: {
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.bg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
  },
  sheetTitle: {
    fontFamily: typography.body.family,
    fontSize: 18,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  roleLabel: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkMute,
    marginBottom: spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  roleBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginRight: spacing.sm,
  },
  roleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roleBtnText: {
    fontFamily: typography.body.family,
    color: colors.ink,
  },
  roleBtnTextActive: {
    color: colors.bg,
  },
  submitBtn: {
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.bg,
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  staffName: {
    fontFamily: typography.body.family,
    fontSize: 18,
    color: colors.ink,
  },
  staffMeta: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkMute,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: typography.body.family,
    fontSize: 12,
  },
});
