import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CustomerResponse,
  DeletionRequestResponse,
  FamilyMemberResponse,
} from '@goldsmith/shared';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/authStore';
import { BalanceCard } from '../../src/features/crm/components/BalanceCard';
import { DeletionRequestSheet } from '../../src/features/crm/components/DeletionRequestSheet';
import { DeletionStatusBanner } from '../../src/features/crm/components/DeletionStatusBanner';
import { FamilyLinker } from '../../src/features/crm/components/FamilyLinker';
import { LoyaltyCard } from '../../src/features/crm/components/LoyaltyCard';
import { NotesSection, type NoteResponse } from '../../src/features/crm/components/NotesSection';
import {
  OccasionsSection,
  type OccasionRow,
} from '../../src/features/crm/components/OccasionsSection';
import { PurchaseHistoryList } from '../../src/features/crm/components/PurchaseHistoryList';

interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
}

export default function CustomerDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = id ?? '';
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showDeletionSheet, setShowDeletionSheet] = useState(false);
  const [deletionHardDeleteAt, setDeletionHardDeleteAt] = useState<string | null>(null);

  const { data: customer } = useQuery<CustomerResponse>({
    queryKey: ['customer', customerId],
    queryFn: async () => (await api.get<CustomerResponse>(`/api/v1/crm/customers/${customerId}`)).data,
    enabled: !!customerId,
  });

  const { data: familyLinks = [], isLoading: familyLoading } = useQuery<FamilyMemberResponse[]>({
    queryKey: ['customer-family', customerId],
    queryFn: async () =>
      (await api.get<FamilyMemberResponse[]>(`/api/v1/crm/customers/${customerId}/family`)).data,
    enabled: !!customerId,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<NoteResponse[]>({
    queryKey: ['customer-notes', customerId],
    queryFn: async () =>
      (await api.get<NoteResponse[]>(`/api/v1/crm/customers/${customerId}/notes`)).data,
    enabled: !!customerId,
  });

  const { data: occasions = [], isLoading: occasionsLoading } = useQuery<OccasionRow[]>({
    queryKey: ['customer-occasions', customerId],
    queryFn: async () =>
      (await api.get<OccasionRow[]>(`/api/v1/crm/customers/${customerId}/occasions`)).data,
    enabled: !!customerId,
  });

  const linkMutation = useMutation({
    mutationFn: async ({
      relatedCustomerId,
      relationship,
    }: {
      relatedCustomerId: string;
      relationship: string;
    }) =>
      (await api.post<FamilyMemberResponse>(`/api/v1/crm/customers/${customerId}/family`, {
        relatedCustomerId,
        relationship,
      })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-family', customerId] }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) =>
      api.delete(`/api/v1/crm/customers/${customerId}/family/${linkId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-family', customerId] }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) =>
      api.post<NoteResponse>(`/api/v1/crm/customers/${customerId}/notes`, { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-notes', customerId] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) =>
      api.delete(`/api/v1/crm/customers/${customerId}/notes/${noteId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-notes', customerId] }),
  });

  const addOccasionMutation = useMutation({
    mutationFn: async (dto: { occasionType: string; monthDay: string; label?: string }) =>
      api.post<OccasionRow>(`/api/v1/crm/customers/${customerId}/occasions`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-occasions', customerId] }),
  });

  const deleteOccasionMutation = useMutation({
    mutationFn: async (occasionId: string) =>
      api.delete(`/api/v1/crm/customers/${customerId}/occasions/${occasionId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-occasions', customerId] }),
  });

  async function searchCustomers(q: string): Promise<CustomerSearchResult[]> {
    const res = await api.get<{ customers: CustomerResponse[] }>('/api/v1/crm/customers', {
      params: { q, limit: 10 },
    });
    return res.data.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  }

  const requestDeletion = async (
    targetCustomerId: string,
    confirmationName: string,
    requestedBy: 'customer' | 'owner',
  ): Promise<DeletionRequestResponse> => {
    const res = await api.post<DeletionRequestResponse>(
      `/api/v1/crm/customers/${targetCustomerId}/request-deletion`,
      { confirmationName, requestedBy },
    );
    return res.data;
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {customer ? (
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{customer.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerPhone}>{customer.phone}</Text>
              {customer.city ? <Text style={styles.customerMeta}>{customer.city}</Text> : null}
            </View>
          </View>
        ) : null}

        <DeletionStatusBanner hardDeleteAt={deletionHardDeleteAt} />

        {customerId ? <BalanceCard customerId={customerId} /> : null}
        {customerId ? <LoyaltyCard customerId={customerId} /> : null}

        <View style={styles.section}>
          <PurchaseHistoryList customerId={customerId} />
        </View>

        <View style={styles.section}>
          <FamilyLinker
            customerId={customerId}
            links={familyLinks}
            loading={familyLoading}
            onLinkAdd={async (relatedCustomerId, relationship) => {
              await linkMutation.mutateAsync({ relatedCustomerId, relationship });
            }}
            onLinkRemove={async (linkId) => {
              await unlinkMutation.mutateAsync(linkId);
            }}
            onSearchCustomers={searchCustomers}
          />
        </View>

        <View style={styles.section}>
          <NotesSection
            customerId={customerId}
            notes={notes}
            loading={notesLoading}
            currentUserId={user?.id ?? ''}
            currentUserRole={user?.role ?? ''}
            onAddNote={async (body) => {
              await addNoteMutation.mutateAsync(body);
            }}
            onDeleteNote={async (noteId) => {
              await deleteNoteMutation.mutateAsync(noteId);
            }}
          />
        </View>

        <View style={styles.section}>
          <OccasionsSection
            customerId={customerId}
            occasions={occasions}
            loading={occasionsLoading}
            onAddOccasion={async (dto) => {
              await addOccasionMutation.mutateAsync(dto);
            }}
            onDeleteOccasion={async (occasionId) => {
              await deleteOccasionMutation.mutateAsync(occasionId);
            }}
          />
        </View>

        {user?.role === 'shop_admin' && customer ? (
          <Pressable
            style={styles.deleteButton}
            onPress={() => setShowDeletionSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Request customer deletion"
          >
            <Text style={styles.deleteButtonText}>Request customer deletion</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {customer ? (
        <DeletionRequestSheet
          visible={showDeletionSheet}
          customerId={customerId}
          customerName={customer.name}
          onClose={() => setShowDeletionSheet(false)}
          onRequestDelete={requestDeletion}
          onConfirmed={(response) => {
            setDeletionHardDeleteAt(response.hardDeleteAt);
            setShowDeletionSheet(false);
            void qc.invalidateQueries({ queryKey: ['customer', customerId] });
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: typography.headingMid.family,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  headerText: {
    flex: 1,
  },
  customerName: {
    fontFamily: typography.headingMid.family,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  customerPhone: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
    marginTop: 2,
  },
  customerMeta: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  deleteButtonText: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
});
