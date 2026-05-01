import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Alert, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { getCatalogProduct, verifyHuid } from '../../src/api/endpoints';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METAL_LABELS: Record<string, string> = {
  GOLD: 'सोना', SILVER: 'चाँदी', PLATINUM: 'प्लेटिनम',
};
const PURITY_LABELS: Record<string, string> = {
  GOLD_24K: '24K', GOLD_22K: '22K', GOLD_20K: '20K',
  GOLD_18K: '18K', GOLD_14K: '14K',
  SILVER_999: '999', SILVER_925: '925',
};

function purityLabel(purity: string): string {
  const key = purity.split('_')[0] ?? '';
  const m = METAL_LABELS[key] ?? '';
  const k = PURITY_LABELS[purity] ?? purity;
  return m ? `${m} ${k}` : k;
}

function fmtPaise(paiseStr: string): string {
  const rupees = Number(paiseStr) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(rupees);
}

// ---------------------------------------------------------------------------
// HuidScanModal — wraps expo-camera QR scan. Shows manual fallback too.
// ---------------------------------------------------------------------------

interface HuidScanModalProps {
  productId:  string;
  onClose:    () => void;
  onVerified: (result: { verified: boolean; huid: string; certifyingBody: string }) => void;
}

function HuidScanModal({ productId, onClose, onVerified }: HuidScanModalProps): React.ReactElement {
  const [manualHuid, setManualHuid] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // Camera import is dynamic to avoid a hard crash if the native module is absent
  // (Expo Go / fresh build without expo-camera linked). We gracefully fall back
  // to the manual entry mode if the import fails.
  const [CameraComponent, setCameraComponent] = useState<React.ComponentType<{
    style: object;
    onBarcodeScanned: (data: { data: string }) => void;
  }> | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const cam = require('expo-camera') as {
          CameraView: React.ComponentType<{ style: object; onBarcodeScanned: (d: { data: string }) => void }>;
          Camera: { requestCameraPermissionsAsync: () => Promise<{ status: string }> };
        };
        const { status } = await cam.Camera.requestCameraPermissionsAsync();
        if (status === 'granted') {
          setCameraComponent(() => cam.CameraView);
          setCameraReady(true);
        }
      } catch {
        // expo-camera not linked — manual mode only
      }
    })();
  }, []);

  const verifyMutation = useMutation({
    mutationFn: (payload: string) => verifyHuid(productId, payload),
    onSuccess: (result) => {
      onVerified(result);
      onClose();
    },
    onError: () => {
      Alert.alert('त्रुटि', 'HUID सत्यापन में समस्या आई। पुनः प्रयास करें।');
    },
  });

  const handleScan = (payload: string): void => {
    if (verifyMutation.isPending) return;
    verifyMutation.mutate(payload);
  };

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose} accessibilityLabel="वापस जाएं" style={{ marginRight: spacing.md }}>
            <Text style={{ fontSize: 20, color: colors.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: typography.serif.family, fontSize: 18, color: colors.ink }}>
            HUID QR स्कैन
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
          {/* Instructions */}
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
            आभूषण पर BIS हॉलमार्क QR कोड को कैमरे के सामने रखें।
          </Text>

          {/* Camera viewfinder */}
          {cameraReady && CameraComponent ? (
            <View style={{ borderRadius: radii.lg, overflow: 'hidden', aspectRatio: 1 }}>
              <CameraComponent
                style={{ flex: 1 }}
                onBarcodeScanned={(e) => handleScan(e.data)}
              />
              {/* Scan overlay */}
              <View
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0, right: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                pointerEvents="none"
              >
                <View
                  style={{
                    width: 180,
                    height: 180,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    borderRadius: radii.md,
                  }}
                />
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.border,
                borderRadius: radii.lg,
                aspectRatio: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center', padding: spacing.md }}>
                {'📷'} कैमरा उपलब्ध नहीं{'\n'}कृपया नीचे HUID दर्ज करें
              </Text>
            </View>
          )}

          {/* Manual HUID entry fallback */}
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.ink, fontWeight: '600' }}>
              या HUID मैन्युअली दर्ज करें
            </Text>
            <View
              style={{
                flexDirection: 'row',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
                overflow: 'hidden',
                minHeight: 48,
              }}
            >
              <TextInput
                value={manualHuid}
                onChangeText={setManualHuid}
                placeholder="AB1234"
                placeholderTextColor={colors.inkMute}
                autoCapitalize="characters"
                maxLength={6}
                style={{
                  paddingHorizontal: spacing.sm,
                  fontFamily: 'monospace',
                  fontSize: 16,
                  color: colors.ink,
                  flex: 1,
                  minHeight: 48,
                }}
                accessibilityLabel="HUID दर्ज करें"
              />
              <TouchableOpacity
                onPress={() => {
                  // For now, trigger verify with the typed HUID
                  const huid = manualHuid.trim().toUpperCase();
                  if (huid.length === 6) handleScan(huid);
                  else Alert.alert('अमान्य', 'HUID 6 अक्षर का होना चाहिए');
                }}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.md,
                  justifyContent: 'center',
                  minHeight: 48,
                }}
                accessibilityLabel="HUID सत्यापित करें"
              >
                <Text style={{ fontFamily: typography.body.family, color: colors.white }}>सत्यापित करें</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute }}>
              HUID आभूषण पर या BIS हॉलमार्क सर्टिफिकेट पर मिलेगा।
            </Text>
          </View>

          {verifyMutation.isPending && (
            <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute, marginTop: spacing.xs }}>
                सत्यापन हो रहा है...
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ProductDetailScreen
// ---------------------------------------------------------------------------

export default function ProductDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showScanModal, setShowScanModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean; huid: string; certifyingBody: string;
  } | null>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['catalog-product', id],
    queryFn:  () => getCatalogProduct(id!),
    enabled:  !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
          उत्पाद नहीं मिला।
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: spacing.md, padding: spacing.sm }}
          accessibilityLabel="वापस जाएं"
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.primary }}>← वापस</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isUnavailable = product.quantity === 0;
  const displayPurity  = purityLabel(product.purity);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, minHeight: 44 }}
          accessibilityLabel="उत्पाद सूची पर वापस जाएं"
        >
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.primary }}>
            ← उत्पाद देखें
          </Text>
        </TouchableOpacity>

        {/* Image placeholder */}
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: colors.border,
            borderRadius: radii.lg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 48 }}>💍</Text>
          {isUnavailable && (
            <View
              style={{
                position: 'absolute',
                top: 0, bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                borderRadius: radii.lg,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: typography.body.family, color: '#fff', fontSize: 18 }}>
                उपलब्ध नहीं
              </Text>
            </View>
          )}
        </View>

        {/* Title + badges */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontFamily: typography.serif.family, fontSize: 24, color: colors.ink }}>
            {displayPurity}
          </Text>
          <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>
            SKU: {product.sku}
            {product.categoryName ? ` · ${product.categoryName}` : ''}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
            {product.huid && (
              <View
                style={{
                  backgroundColor: '#F0FDF4',
                  borderColor: '#86EFAC',
                  borderWidth: 1,
                  borderRadius: radii.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: '#15803D' }}>
                  हॉलमार्क ✓ BIS प्रमाणित
                </Text>
              </View>
            )}
            {isUnavailable && (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderColor: '#FECACA',
                  borderWidth: 1,
                  borderRadius: radii.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: '#DC2626' }}>
                  उपलब्ध नहीं
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* HUID verification result */}
        {verifyResult && (
          <View
            style={{
              backgroundColor: verifyResult.verified ? '#F0FDF4' : '#FEF2F2',
              borderColor: verifyResult.verified ? '#86EFAC' : '#FECACA',
              borderWidth: 1,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <Text
              style={{
                fontFamily: typography.body.family,
                fontSize: 14,
                color: verifyResult.verified ? '#15803D' : '#DC2626',
                fontWeight: '600',
              }}
            >
              {verifyResult.verified
                ? `✓ HUID सत्यापित — ${verifyResult.huid} (${verifyResult.certifyingBody})`
                : `✗ HUID मेल नहीं खाया — ${verifyResult.huid}`}
            </Text>
          </View>
        )}

        {/* Weight */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>कुल वज़न</Text>
            <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.ink, fontWeight: '600', marginTop: 2 }}>
              {product.grossWeightG} ग्राम
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>शुद्ध वज़न</Text>
            <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.ink, fontWeight: '600', marginTop: 2 }}>
              {product.netWeightG} ग्राम
            </Text>
          </View>
        </View>

        {/* Price breakdown */}
        {product.priceAvailable && product.estimatedPrice ? (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, fontWeight: '600', color: colors.ink }}>
              मूल्य विवरण
            </Text>
            {[
              { label: 'धातु मूल्य',    value: product.estimatedPrice.breakdown.goldValuePaise },
              { label: 'बनाई शुल्क',   value: product.estimatedPrice.breakdown.makingChargePaise },
              { label: 'GST धातु (3%)', value: product.estimatedPrice.breakdown.gstMetalPaise },
              { label: 'GST बनाई (5%)', value: product.estimatedPrice.breakdown.gstMakingPaise },
            ].map(({ label, value }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>{label}</Text>
                <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.ink }}>{fmtPaise(value)}</Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: spacing.xs,
                marginTop: spacing.xs,
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink, fontWeight: '600' }}>
                अनुमानित कुल
              </Text>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink, fontWeight: '700' }}>
                {product.estimatedPrice.totalFormatted}
              </Text>
            </View>
            <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute }}>
              * पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं।
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
            }}
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
              मूल्य के लिए कृपया दुकान पर संपर्क करें।
            </Text>
          </View>
        )}

        {/* Action CTAs */}
        {!isUnavailable && (
          <View style={{ gap: spacing.sm }}>
            {/* HUID QR scan */}
            {product.huid && (
              <TouchableOpacity
                onPress={() => setShowScanModal(true)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radii.md,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                  minHeight: 48,
                }}
                accessibilityLabel="HUID QR कोड स्कैन करें"
                accessibilityRole="button"
              >
                <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '600' }}>
                  📷 HUID QR स्कैन करें
                </Text>
              </TouchableOpacity>
            )}

            {/* Try at home */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.white,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.primary,
                paddingVertical: spacing.md,
                alignItems: 'center',
                minHeight: 48,
              }}
              accessibilityLabel="घर पर कोशिश करने की जानकारी"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.primary }}>
                🏠 कोशिश घर पर करें
              </Text>
            </TouchableOpacity>

            {/* Rate lock */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.white,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.md,
                alignItems: 'center',
                minHeight: 48,
              }}
              accessibilityLabel="आज का मूल्य लॉक करें"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink }}>
                🔒 दर-लॉक बुकिंग
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* HUID scan modal */}
      {showScanModal && product.huid && (
        <HuidScanModal
          productId={product.id}
          onClose={() => setShowScanModal(false)}
          onVerified={(result) => {
            setVerifyResult(result);
          }}
        />
      )}
    </View>
  );
}
