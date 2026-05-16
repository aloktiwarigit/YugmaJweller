import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { getReturnPolicy } from '../../src/api/endpoints';

export default function PolicyScreen(): React.ReactElement {
  const router = useRouter();
  const { data: policyText, isLoading } = useQuery({
    queryKey: ['return-policy'],
    queryFn:  getReturnPolicy,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <View style={styles.root}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="वापस जाएं">
          <Text style={styles.backText}>← वापस</Text>
        </TouchableOpacity>

        <Text style={styles.title}>वापसी और आदान-प्रदान नीति</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : policyText ? (
          <View style={styles.card}>
            <Text style={styles.policyText}>{policyText}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.noPolicy}>
              इस दुकान की वापसी नीति अभी उपलब्ध नहीं है। अधिक जानकारी के लिए दुकान पर संपर्क करें।
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg },
  scroll:     { padding: 16, paddingBottom: 40 },
  backBtn:    { marginBottom: 16 },
  backText:   { fontFamily: typography.body.family, fontSize: 14, color: colors.primary },
  title:      { fontFamily: typography.serif.family, fontSize: 22, color: colors.ink, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  policyText: { fontFamily: typography.body.family, fontSize: 15, color: colors.ink, lineHeight: 24 },
  noPolicy:   { fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, lineHeight: 24 },
});
