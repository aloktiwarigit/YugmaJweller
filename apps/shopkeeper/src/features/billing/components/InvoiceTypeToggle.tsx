import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/;

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

const SELLER_STATE_CODE = '09';

interface InvoiceTypeToggleProps {
  invoiceType: 'B2C' | 'B2B_WHOLESALE';
  buyerGstin: string;
  buyerBusinessName: string;
  onInvoiceTypeChange: (type: 'B2C' | 'B2B_WHOLESALE') => void;
  onBuyerGstinChange: (gstin: string) => void;
  onBuyerBusinessNameChange: (name: string) => void;
}

export function InvoiceTypeToggle({
  invoiceType,
  buyerGstin,
  buyerBusinessName,
  onInvoiceTypeChange,
  onBuyerGstinChange,
  onBuyerBusinessNameChange,
}: InvoiceTypeToggleProps): JSX.Element {
  const [gstinError, setGstinError] = useState<string | null>(null);

  const handleGstinChange = (text: string): void => {
    const normalized = text.toUpperCase().replace(/\s+/g, '');
    onBuyerGstinChange(normalized);
    setGstinError(null);
  };

  const handleGstinBlur = (): void => {
    if (buyerGstin.length === 0) {
      setGstinError(null);
      return;
    }
    if (buyerGstin.length !== 15) {
      setGstinError('GSTIN format सही नहीं — 15 अक्षर');
      return;
    }
    if (!GSTIN_RE.test(buyerGstin)) {
      setGstinError('GSTIN format सही नहीं');
      return;
    }
    setGstinError(null);
  };

  const isValidGstin = buyerGstin.length === 15 && GSTIN_RE.test(buyerGstin);
  const buyerStateCode = buyerGstin.length >= 2 ? buyerGstin.slice(0, 2) : null;
  const stateName = buyerStateCode ? STATE_CODES[buyerStateCode] : null;
  const isIntrastate = buyerStateCode === SELLER_STATE_CODE;

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, invoiceType === 'B2C' && styles.toggleBtnActive]}
          onPress={() => onInvoiceTypeChange('B2C')}
          accessibilityRole="button"
          accessibilityState={{ selected: invoiceType === 'B2C' }}
        >
          <Text style={[styles.toggleText, invoiceType === 'B2C' && styles.toggleTextActive]}>
            B2C (ग्राहक)
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, invoiceType === 'B2B_WHOLESALE' && styles.toggleBtnActive]}
          onPress={() => onInvoiceTypeChange('B2B_WHOLESALE')}
          accessibilityRole="button"
          accessibilityState={{ selected: invoiceType === 'B2B_WHOLESALE' }}
        >
          <Text
            style={[
              styles.toggleText,
              invoiceType === 'B2B_WHOLESALE' && styles.toggleTextActive,
            ]}
          >
            B2B (थोक)
          </Text>
        </Pressable>
      </View>

      {invoiceType === 'B2B_WHOLESALE' && (
        <View style={styles.b2bFields}>
          <Text style={styles.fieldLabel}>GSTIN *</Text>
          <TextInput
            value={buyerGstin}
            onChangeText={handleGstinChange}
            onBlur={handleGstinBlur}
            style={[styles.gstinInput, gstinError ? styles.inputError : null]}
            placeholder="22AAAAA0000A1Z5"
            autoCapitalize="characters"
            maxLength={15}
            keyboardType="default"
            accessibilityLabel="GSTIN number"
            accessibilityHint="15 अक्षर — 2 अंक राज्य कोड + 13 अक्षर"
          />
          {gstinError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {gstinError}
            </Text>
          ) : null}

          {isValidGstin && stateName ? (
            <View style={styles.gstBadge}>
              <Text style={styles.gstBadgeText}>
                {stateName} —{' '}
                {isIntrastate ? 'CGST + SGST (Intrastate)' : 'IGST (Interstate)'}
              </Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>व्यापार का नाम (वैकल्पिक)</Text>
          <TextInput
            value={buyerBusinessName}
            onChangeText={onBuyerBusinessNameChange}
            style={styles.input}
            placeholder="व्यापार का नाम"
            accessibilityLabel="व्यापार का नाम"
            maxLength={200}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7e5e4',
    paddingVertical: 12,
  },
  toggleBtnActive: {
    backgroundColor: '#92400e',
  },
  toggleText: {
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
    color: '#292524',
  },
  toggleTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  b2bFields: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'NotoSansDevanagari',
    color: '#44403c',
    marginBottom: 4,
  },
  gstinInput: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    marginBottom: 4,
    minHeight: 48,
    color: '#1c1917',
    backgroundColor: '#ffffff',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
    minHeight: 48,
    color: '#1c1917',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    marginBottom: 8,
  },
  gstBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  gstBadgeText: {
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    color: '#92400e',
  },
});
