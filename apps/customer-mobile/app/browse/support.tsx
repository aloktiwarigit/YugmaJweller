import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useTenantStore } from '../../src/stores/tenantStore';

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function SupportScreen(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenantStore((s) => s.tenant);
  const shopName = tenant?.branding.appName ?? tenant?.displayName ?? 'दुकान';

  return (
    <View style={styles.root}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="वापस जाएं"
        >
          <Text style={styles.backText}>← वापस</Text>
        </TouchableOpacity>

        <Text style={styles.title}>सहायता</Text>
        <Text style={styles.intro}>
          {shopName} से जुड़ी खरीदारी, ऑर्डर, दर-लॉक और ट्राई-एट-होम सहायता के लिए दुकान से संपर्क करें।
        </Text>

        <View style={styles.card}>
          <InfoRow label="ऑर्डर" value="प्रोफ़ाइल में खरीदारी और बुकिंग की स्थिति देखें।" />
          <InfoRow label="दर-लॉक" value="बुकिंग या भुगतान में समस्या हो तो दुकान पर बुकिंग आईडी बताएं।" />
          <InfoRow label="ट्राई-एट-होम" value="भेजने और वापसी की तारीख दुकान द्वारा पुष्टि की जाएगी।" />
          <InfoRow label="नीति" value="वापसी और आदान-प्रदान नीति सहायता सेक्शन में उपलब्ध है।" />
        </View>

        <TouchableOpacity
          onPress={() => router.push('/browse/policy' as Parameters<typeof router.push>[0])}
          style={styles.primaryAction}
          accessibilityRole="button"
          accessibilityLabel="वापसी नीति देखें"
        >
          <Text style={styles.primaryActionText}>वापसी नीति देखें</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  backBtn: { marginBottom: spacing.md, minHeight: 44, justifyContent: 'center' },
  backText: { fontFamily: typography.body.family, fontSize: 14, color: colors.primary },
  title: { fontFamily: typography.display.family, fontSize: 24, color: colors.ink, marginBottom: spacing.sm },
  intro: { fontFamily: typography.body.family, fontSize: 15, lineHeight: 23, color: colors.inkMute, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: { gap: 2 },
  infoLabel: { fontFamily: typography.headingMid.family, fontSize: 14, color: colors.ink },
  infoValue: { fontFamily: typography.body.family, fontSize: 13, lineHeight: 20, color: colors.inkMute },
  primaryAction: {
    marginTop: spacing.lg,
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: { fontFamily: typography.body.family, fontSize: 16, fontWeight: '700', color: colors.white },
});
