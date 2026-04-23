import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { TryAtHomeToggle } from '../../src/features/settings/components/TryAtHomeToggle';
import { api } from '../../src/api/client';

interface TryAtHomeResponse {
  tryAtHomeEnabled: boolean;
  tryAtHomeMaxPieces: number;
  etag: string;
}

const DEFAULTS = { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 };

export default function TryAtHomeScreen(): React.ReactElement {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<TryAtHomeResponse>({
    queryKey: ['settings', 'try-at-home'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/try-at-home');
      return response.data as TryAtHomeResponse;
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: { tryAtHomeEnabled?: boolean; tryAtHomeMaxPieces?: number }) => {
      const response = await api.patch('/api/v1/settings/try-at-home', patch);
      return response.data as TryAtHomeResponse;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', 'try-at-home'], updated);
    },
  });

  const handleSave = async (
    patch: { tryAtHomeEnabled?: boolean; tryAtHomeMaxPieces?: number },
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      mutation.mutate(patch, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TryAtHomeToggle
        enabled={data?.tryAtHomeEnabled ?? DEFAULTS.tryAtHomeEnabled}
        maxPieces={data?.tryAtHomeMaxPieces ?? DEFAULTS.tryAtHomeMaxPieces}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
});
