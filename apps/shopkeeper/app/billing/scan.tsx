// apps/shopkeeper/app/billing/scan.tsx
// Barcode scanner for invoice line selection — wired in Story 5.2
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function BillingBarcodeScanScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>बारकोड स्कैन</Text>
      <Text style={styles.body}>यह सुविधा जल्द आ रही है (Story 5.2)</Text>
      <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backText}>← वापस जाएं</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fafaf9' },
  title:       { fontSize: 22, fontWeight: '700', fontFamily: 'NotoSansDevanagari', marginBottom: 12 },
  body:        { fontSize: 16, color: '#57534e', fontFamily: 'NotoSansDevanagari', marginBottom: 32, textAlign: 'center' },
  backButton:  { backgroundColor: '#92400e', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14, minHeight: 48 },
  backText:    { color: '#fff', fontWeight: '600', fontFamily: 'NotoSansDevanagari' },
});
