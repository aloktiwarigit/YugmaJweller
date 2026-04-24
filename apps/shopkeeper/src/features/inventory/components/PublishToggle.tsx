import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';

const SUCCESS_GREEN = '#2E7D32';

interface PublishToggleProps {
  productId: string;
  publishedAt: string | null;
  onToggle?: () => void;
  disabled?: boolean;
  /** OWNER / MANAGER can toggle; STAFF sees badge only */
  canEdit?: boolean;
}

export function PublishToggle({
  productId,
  publishedAt,
  onToggle,
  disabled = false,
  canEdit = true,
}: PublishToggleProps): React.ReactElement {
  const queryClient = useQueryClient();
  const isPublished = publishedAt !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = isPublished
        ? `/api/v1/inventory/products/${productId}/unpublish`
        : `/api/v1/inventory/products/${productId}/publish`;
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onToggle?.();
    },
  });

  return (
    <View style={styles.container}>
      <View
        style={[styles.badge, isPublished ? styles.badgePublished : styles.badgeUnpublished]}
        accessibilityLabel={isPublished ? 'प्रकाशित' : 'अप्रकाशित'}
      >
        <Text style={[styles.badgeText, isPublished ? styles.badgeTextPublished : styles.badgeTextUnpublished]}>
          {isPublished ? 'प्रकाशित ✓' : 'अप्रकाशित'}
        </Text>
      </View>

      {canEdit && (
        <Pressable
          style={[
            styles.button,
            isPublished ? styles.buttonUnpublish : styles.buttonPublish,
            (disabled || mutation.isPending) && styles.buttonDisabled,
          ]}
          onPress={() => mutation.mutate()}
          disabled={disabled || mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={isPublished ? 'अप्रकाशित करें' : 'प्रकाशित करें'}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {isPublished ? 'अप्रकाशित करें' : 'प्रकाशित करें'}
            </Text>
          )}
        </Pressable>
      )}

      {mutation.isError && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'कार्रवाई विफल रही, पुनः प्रयास करें'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgePublished: {
    borderColor: SUCCESS_GREEN,
    backgroundColor: '#E8F5E9',
  },
  badgeUnpublished: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  badgeText: {
    ...typography.body,
    fontSize: 14,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  badgeTextPublished: {
    color: SUCCESS_GREEN,
    fontWeight: '600',
  },
  badgeTextUnpublished: {
    color: colors.textSecondary,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPublish: {
    backgroundColor: colors.primary,
  },
  buttonUnpublish: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari_400Regular',
    color: colors.white,
  },
  errorText: {
    ...typography.body,
    fontSize: 14,
    color: colors.error,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
});
