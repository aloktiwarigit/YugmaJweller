import React from 'react';
import { View, ScrollView, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { t } from '@goldsmith/i18n';
import { colors } from '@goldsmith/ui-tokens';
import { WastageRow } from '../../src/features/settings/components/WastageRow';
import { api } from '../../src/api/client';

interface WastageConfig {
  category: string;
  percent: string;
}

interface WastageResponse {
  configs: WastageConfig[];
}

export default function WastageScreen(): React.ReactElement {
  const translate = (key: string): string => t(`settings.${key}`);

  const { data, isLoading, error } = useQuery<WastageResponse>({
    queryKey: ['wastage'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/wastage');
      return response.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ category, percent }: { category: string; percent: string }) => {
      const response = await api.patch('/api/v1/settings/wastage', { category, percent });
      return response.data;
    },
  });

  const handleSave = (category: string) => async (percent: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      mutation.mutate(
        { category, percent },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{translate('wastage.error_load')}</Text>
      </View>
    );
  }

  const categories: Record<string, string> = {
    RINGS: translate('making_charges.categories.RINGS'),
    CHAINS: translate('making_charges.categories.CHAINS'),
    BANGLES: translate('making_charges.categories.BANGLES'),
    BRIDAL: translate('making_charges.categories.BRIDAL'),
    SILVER: translate('making_charges.categories.SILVER'),
    WHOLESALE: translate('making_charges.categories.WHOLESALE'),
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{translate('wastage.title')}</Text>
      {data?.configs && data.configs.length > 0 ? (
        data.configs.map((config) => (
          <WastageRow
            key={config.category}
            percent={config.percent}
            label={categories[config.category] || config.category}
            onSave={handleSave(config.category)}
          />
        ))
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorText: {
    fontSize: 14,
    color: '#B1402B',
    textAlign: 'center',
  },
});
