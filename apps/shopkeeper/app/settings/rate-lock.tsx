import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { RateLockDurationPicker } from '../../src/features/settings/components/RateLockDurationPicker';
import { api } from '../../src/api/client';

interface RateLockResponse {
  rateLockDays: number;
  etag: string;
}

const DEFAULT_DAYS = 7;

export default function RateLockScreen(): React.ReactElement {
  const { data, isLoading } = useQuery<RateLockResponse>({
    queryKey: ['settings', 'rate-lock'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/rate-lock');
      return response.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (days: number) => {
      const response = await api.patch('/api/v1/settings/rate-lock', { rateLockDays: days });
      return response.data;
    },
  });

  const handleSave = async (days: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      mutation.mutate(days, {
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
      <RateLockDurationPicker
        days={data?.rateLockDays ?? DEFAULT_DAYS}
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
