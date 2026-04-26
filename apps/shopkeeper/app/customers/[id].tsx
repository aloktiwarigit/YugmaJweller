import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { FamilyMemberResponse, CustomerResponse } from '@goldsmith/shared';
import { FamilyLinker } from '../../src/features/crm/components/FamilyLinker';

interface CustomerSearchResult { id: string; name: string; phone: string; }

export default function CustomerDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: customer } = useQuery<CustomerResponse>({ queryKey: ['customer', id], queryFn: async () => (await api.get<CustomerResponse>(`/api/v1/crm/customers/${id}`)).data, enabled: !!id });
  const { data: familyLinks = [], isLoading: familyLoading } = useQuery<FamilyMemberResponse[]>({ queryKey: ['customer-family', id], queryFn: async () => (await api.get<FamilyMemberResponse[]>(`/api/v1/crm/customers/${id}/family`)).data, enabled: !!id });
  const linkMutation = useMutation({ mutationFn: async ({ relatedCustomerId, relationship }: { relatedCustomerId: string; relationship: string }) => (await api.post<FamilyMemberResponse>(`/api/v1/crm/customers/${id}/family`, { relatedCustomerId, relationship })).data, onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-family', id] }) });
  const unlinkMutation = useMutation({ mutationFn: async (linkId: string) => api.delete(`/api/v1/crm/customers/${id}/family/${linkId}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['customer-family', id] }) });
  async function searchCustomers(q: string): Promise<CustomerSearchResult[]> { const res = await api.get<{ customers: CustomerResponse[] }>(`/api/v1/crm/customers`, { params: { q, limit: 10 } }); return res.data.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })); }
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {customer && (<View style={styles.header}><Text style={styles.customerName}>{customer.name}</Text><Text style={styles.customerPhone}>{customer.phone}</Text></View>)}
      <FamilyLinker customerId={id ?? ''} links={familyLinks} loading={familyLoading} onLinkAdd={async (relatedCustomerId, relationship) => { await linkMutation.mutateAsync({ relatedCustomerId, relationship }); }} onLinkRemove={async (linkId) => { await unlinkMutation.mutateAsync(linkId); }} onSearchCustomers={searchCustomers} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5EDDD' }, content: { padding: 20, paddingBottom: 48, gap: 20 }, header: { gap: 4, marginBottom: 8 }, customerName: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 22, color: '#5C3D11' }, customerPhone: { fontSize: 16, color: '#7A5400' } });
