import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Alert, TextInput,
  SafeAreaView, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import {
  getCatalogProduct,
  verifyHuid,
  getProductRecommendations,
  getCatalogProductReviews,
} from '../../src/api/endpoints';
import type { CatalogProduct } from '../../src/api/endpoints';
import { ProductGallery } from '../../src/components/products/ProductGallery';
import { useProductImages } from '../../src/hooks/useProductImages';

// ─── Colour tokens not yet on origin/main (land with D1D2D5) ───────────────────
const SURFACE_ELEVATED = '#FFFBF2';
const SUCCESS_JADE     = '#2F7D5B';
const SUCCESS_WASH     = '#DCEEE3';
const SURFACE_RECESSED = '#EDE2CC';
const WARNING_SAFFRON  = '#C68A1F';
// ───────────────────────────────────────────────────────────────────────────────

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
// StarRow
// ---------------------------------------------------------------------------

function StarRow({ rating }: { rating: number }): React.ReactElement {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {stars.map((filled, i) => (
        <Text
          key={i}
          style={{ fontSize: 14, color: filled ? WARNING_SAFFRON : colors.border }}
          accessibilityElementsHidden
        >
          {filled ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// CompactProductCard — for "complete the look" row
// ---------------------------------------------------------------------------

function CompactProductCard({ product }: { product: CatalogProduct }): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/browse/${product.id}`)}
      style={{
        width: 120,
        backgroundColor: colors.white,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginRight: spacing.sm,
      }}
      accessibilityLabel={`${purityLabel(product.purity)} — ${product.sku}`}
      accessibilityRole="button"
    >
      <View style={{ width: 120, height: 150, backgroundColor: colors.border }} />
      <View style={{ padding: spacing.xs }}>
        <Text
          style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.ink, fontWeight: '600' }}
          numberOfLines={1}
        >
          {purityLabel(product.purity)}
        </Text>
        {product.priceAvailable && product.estimatedPrice && (
          <Text
            style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute, marginTop: 2 }}
            numberOfLines={1}
          >
            {product.estimatedPrice.totalFormatted}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// HuidScanModal
// ---------------------------------------------------------------------------

interface HuidScanModalProps {
  productId:  string;
  onClose:    () => void;
  onVerified: (result: { verified: boolean; huid: string; certifyingBody: string }) => void;
}

function HuidScanModal({ productId, onClose, onVerified }: HuidScanModalProps): React.ReactElement {
  const [manualHuid, setManualHuid] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

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
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
            आभूषण पर BIS हॉलमार्क QR कोड को कैमरे के सामने रखें।
          </Text>

          {cameraReady && CameraComponent ? (
            <View style={{ borderRadius: radii.lg, overflow: 'hidden', aspectRatio: 1 }}>
              <CameraComponent
                style={{ flex: 1 }}
                onBarcodeScanned={(e) => handleScan(e.data)}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0, right: 0,
                  justifyContent: 'center', alignItems: 'center',
                }}
                pointerEvents="none"
              >
                <View style={{ width: 180, height: 180, borderWidth: 2, borderColor: colors.primary, borderRadius: radii.md }} />
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.border,
                borderRadius: radii.lg,
                aspectRatio: 1,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center', padding: spacing.md }}>
                {'📷'} कैमरा उपलब्ध नहीं{'\n'}कृपया नीचे HUID दर्ज करें
              </Text>
            </View>
          )}

          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.ink, fontWeight: '600' }}>
              या HUID मैन्युअली दर्ज करें
            </Text>
            <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: 'hidden', minHeight: 48 }}>
              <TextInput
                value={manualHuid}
                onChangeText={setManualHuid}
                placeholder="AB1234"
                placeholderTextColor={colors.inkMute}
                autoCapitalize="characters"
                maxLength={6}
                style={{ paddingHorizontal: spacing.sm, fontFamily: 'monospace', fontSize: 16, color: colors.ink, flex: 1, minHeight: 48 }}
                accessibilityLabel="HUID दर्ज करें"
              />
              <TouchableOpacity
                onPress={() => {
                  const huid = manualHuid.trim().toUpperCase();
                  if (huid.length === 6) handleScan(huid);
                  else Alert.alert('अमान्य', 'HUID 6 अक्षर का होना चाहिए');
                }}
                style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.md, justifyContent: 'center', minHeight: 48 }}
                accessibilityLabel="HUID सत्यापित करें"
              >
                <Text style={{ fontFamily: typography.body.family, color: colors.white }}>सत्यापित करें</Text>
              </TouchableOpacity>
            </View>
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
  const [isWishlisted, setIsWishlisted]   = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean; huid: string; certifyingBody: string;
  } | null>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['catalog-product', id],
    queryFn:  () => getCatalogProduct(id!),
    enabled:  !!id,
    retry: false,
  });

  const { data: productImages } = useProductImages(id);

  const { data: recommendationsData } = useQuery({
    queryKey: ['product-recommendations', id],
    queryFn:  () => getProductRecommendations(id!),
    enabled:  !!id,
    retry: false,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['product-reviews-public', id],
    queryFn:  () => getCatalogProductReviews(id!),
    enabled:  !!id,
    retry: false,
  });

  const recommendations = recommendationsData?.items ?? [];
  const reviews         = reviewsData?.items ?? [];

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

  const isUnavailable  = product.quantity === 0;
  const displayPurity  = purityLabel(product.purity);
  const priceFormatted = product.priceAvailable && product.estimatedPrice
    ? product.estimatedPrice.totalFormatted
    : null;

  const handleShare = async (): Promise<void> => {
    try {
      await Share.share({
        message: `${displayPurity} — SKU ${product.sku}${priceFormatted ? `\nअनुमानित मूल्य: ${priceFormatted}` : ''}`,
        title: displayPurity,
      });
    } catch {
      // user dismissed
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Main scrollable content — paddingBottom reserves space for sticky bar */}
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 96 }}>
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

        {/* Product gallery */}
        <View style={{ marginHorizontal: -spacing.md, overflow: 'hidden' }}>
          <ProductGallery images={productImages} productName={product.purity} />
          {isUnavailable && (
            <View
              style={{
                position: 'absolute',
                top: 0, bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                justifyContent: 'center', alignItems: 'center',
              }}
              pointerEvents="none"
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
            SKU: {product.sku}{product.categoryName ? ` · ${product.categoryName}` : ''}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
            {product.huid && (
              <View style={{ backgroundColor: SUCCESS_WASH, borderColor: SUCCESS_JADE, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                <Text
                  style={{ fontFamily: typography.body.family, fontSize: 12, color: SUCCESS_JADE }}
                  accessibilityLabel={`HUID सत्यापित — हॉलमार्क पंजीकरण क्रमांक ${product.huid}`}
                  accessibilityRole="image"
                >
                  HUID ✓ BIS प्रमाणित
                </Text>
              </View>
            )}
            {isUnavailable && (
              <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: '#DC2626' }}>
                  उपलब्ध नहीं
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Trust strip — horizontally scrollable pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {[
            { label: 'BIS/HUID ✓',        bg: SUCCESS_WASH, text: SUCCESS_JADE },
            { label: 'निःशुल्क एक्सचेंज', bg: SURFACE_RECESSED, text: colors.ink },
            { label: 'घर पर ट्राय',        bg: SURFACE_RECESSED, text: colors.ink },
            { label: 'WhatsApp सहायता',    bg: SURFACE_RECESSED, text: colors.ink },
          ].map(({ label, bg, text }) => (
            <View
              key={label}
              style={{
                backgroundColor: bg,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.sm,
                height: 28,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 12, fontWeight: '600', color: text }}>
                {label}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* HUID verification result */}
        {verifyResult && (
          <View
            style={{
              backgroundColor: verifyResult.verified ? SUCCESS_WASH : '#FEF2F2',
              borderColor: verifyResult.verified ? SUCCESS_JADE : '#FECACA',
              borderWidth: 1,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: verifyResult.verified ? SUCCESS_JADE : '#DC2626', fontWeight: '600' }}>
              {verifyResult.verified
                ? `✓ HUID सत्यापित — ${verifyResult.huid} (${verifyResult.certifyingBody})`
                : `✗ HUID मेल नहीं खाया — ${verifyResult.huid}`}
            </Text>
          </View>
        )}

        {/* Weight */}
        <View style={{ backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', gap: spacing.md }}>
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
          <View style={{ backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs, marginTop: spacing.xs }}>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink, fontWeight: '600' }}>अनुमानित कुल</Text>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink, fontWeight: '700' }}>
                {product.estimatedPrice.totalFormatted}
              </Text>
            </View>
            <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute }}>
              * पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं।
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
              मूल्य के लिए कृपया दुकान पर संपर्क करें।
            </Text>
          </View>
        )}

        {/* Action CTAs — HUID scan + Try at Home */}
        {!isUnavailable && (
          <View style={{ gap: spacing.sm }}>
            {product.huid && (
              <TouchableOpacity
                onPress={() => setShowScanModal(true)}
                style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 48 }}
                accessibilityLabel="HUID QR कोड स्कैन करें"
                accessibilityRole="button"
              >
                <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '600' }}>
                  📷 HUID QR स्कैन करें
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push('/try-at-home' as any)}
              style={{ backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, paddingVertical: spacing.md, alignItems: 'center', minHeight: 48 }}
              accessibilityLabel="घर पर कोशिश करने की जानकारी"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.primary }}>
                🏠 कोशिश घर पर करें
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Share + Rate-lock + Wishlist row */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xs }}>
          {[
            {
              label: 'शेयर',
              icon: '↗',
              onPress: handleShare,
              a11y: 'इस उत्पाद को शेयर करें',
            },
            {
              label: 'दर-लॉक',
              icon: '🔒',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress: () => router.push('/rate-lock' as any),
              a11y: 'आज का मूल्य लॉक करें',
            },
            {
              label: isWishlisted ? 'विशलिस्ट ✓' : 'विशलिस्ट',
              icon: isWishlisted ? '♥' : '♡',
              onPress: () => setIsWishlisted((v) => !v),
              a11y: isWishlisted ? 'विशलिस्ट से हटाएं' : 'विशलिस्ट में जोड़ें',
            },
          ].map(({ label, icon, onPress, a11y }) => (
            <TouchableOpacity
              key={label}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.white,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.sm,
                minHeight: 56,
                gap: 4,
              }}
              accessibilityLabel={a11y}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 20 }}>{icon}</Text>
              <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* "Complete the look" row */}
        {recommendations.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontFamily: typography.serif.family, fontSize: 16, color: colors.ink }}>
              इसके साथ पहनें
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recommendations.map((rec) => (
                <CompactProductCard key={rec.id} product={rec} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reviews section */}
        {reviews.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text style={{ fontFamily: typography.serif.family, fontSize: 16, color: colors.ink }}>
                समीक्षाएं
              </Text>
              {reviewsData?.total !== undefined && reviewsData.total > 0 && (
                <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>
                  ({reviewsData.total})
                </Text>
              )}
            </View>
            {reviews.slice(0, 6).map((rev) => (
              <View
                key={rev.id}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StarRow rating={rev.rating} />
                  <Text
                    style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}
                    accessibilityLabel={`समीक्षा दिनांक ${new Date(rev.createdAt).toLocaleDateString('hi-IN')}`}
                  >
                    {new Date(rev.createdAt).toLocaleDateString('hi-IN')}
                  </Text>
                </View>
                <Text
                  style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}
                  accessibilityLabel={`समीक्षक: ${rev.customerDisplayName}, ${rev.rating} में से 5 तारे`}
                >
                  {rev.customerDisplayName}
                </Text>
                {rev.reviewText && (
                  <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink }}>
                    {rev.reviewText}
                  </Text>
                )}
              </View>
            ))}
            {reviewsData?.total !== undefined && reviewsData.total > 6 && (
              <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.primary }}>
                  और समीक्षाएं →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <SafeAreaView
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: SURFACE_ELEVATED,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}>
          {/* Price */}
          <View style={{ flex: 1 }}>
            {priceFormatted ? (
              <>
                <Text style={{ fontFamily: typography.body.family, fontSize: 20, fontWeight: '700', color: colors.ink }}>
                  {priceFormatted}
                </Text>
                <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute }}>
                  अनुमानित · आज की दर पर
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>
                मूल्य हेतु संपर्क करें
              </Text>
            )}
          </View>

          {/* Wishlist */}
          <TouchableOpacity
            onPress={() => setIsWishlisted((v) => !v)}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: isWishlisted ? colors.accent : colors.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityLabel={isWishlisted ? 'विशलिस्ट से हटाएं' : 'विशलिस्ट में जोड़ें'}
            accessibilityRole="button"
            accessibilityState={{ pressed: isWishlisted }}
          >
            <Text style={{ fontSize: 20, color: isWishlisted ? colors.accent : colors.inkMute }}>
              {isWishlisted ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>

          {/* Primary CTA */}
          {!isUnavailable && (
            <TouchableOpacity
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push('/try-at-home' as any)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radii.md,
                paddingHorizontal: spacing.lg,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 96,
              }}
              accessibilityLabel="उत्पाद जोड़ें — घर पर ट्राय करें"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                जोड़ें
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* HUID scan modal */}
      {showScanModal && product.huid && (
        <HuidScanModal
          productId={product.id}
          onClose={() => setShowScanModal(false)}
          onVerified={(result) => setVerifyResult(result)}
        />
      )}
    </View>
  );
}
