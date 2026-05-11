import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing, radii, typography } from '@goldsmith/ui-tokens';
import { PRICE_BANDS, CATALOG_STYLES, CATALOG_OCCASIONS, CATALOG_SORTS } from '@goldsmith/customer-shared';
import type { CatalogSort } from '@goldsmith/customer-shared';
import {
  EMPTY_FILTERS,
  METAL_FILTER_LABELS,
  PURITY_FILTER_LABELS,
  STYLE_FILTER_LABELS,
  OCCASION_FILTER_LABELS,
} from '../lib/catalog-filter-utils';
import type { ActiveFilters } from '../lib/catalog-filter-utils';

// ─── Colour tokens not yet on origin/main (land with D1D2D5) ───────────────────
const SURFACE_ELEVATED  = '#FFFBF2';
const SURFACE_RECESSED  = '#EDE2CC';
const PRIMARY_DEEP      = '#8C6628';
const BORDER_STRONG     = '#B89F70';
const PRIMARY_WASH      = colors.primaryLight; // '#EFE3BE'
// ───────────────────────────────────────────────────────────────────────────────

const PURITY_ORDER = [
  'GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K',
  'SILVER_999', 'SILVER_925',
] as const;

const SORT_LABELS: Record<CatalogSort, string> = {
  newest:     'नवीनतम',
  priceAsc:   'मूल्य: कम से अधिक',
  priceDesc:  'मूल्य: अधिक से कम',
  trending:   'ट्रेंडिंग',
  bestseller: 'सबसे लोकप्रिय',
};

// ─── Section accordion ─────────────────────────────────────────────────────────

function SectionHeader({
  title, isOpen, onToggle,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: isOpen ? 0 : 1,
        borderBottomColor: colors.border,
        minHeight: 48,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title} अनुभाग ${isOpen ? 'बंद करें' : 'खोलें'}`}
      accessibilityState={{ expanded: isOpen }}
    >
      <Text style={{ fontFamily: typography.body.family, fontSize: 15, fontWeight: '600', color: colors.ink }}>
        {title}
      </Text>
      <Text style={{ fontSize: 16, color: colors.inkMute }}>{isOpen ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ─── Filter state reducer ──────────────────────────────────────────────────────

type FilterAction =
  | { type: 'SET_METAL';    metal: string | undefined }
  | { type: 'TOGGLE_PURITY'; purity: string }
  | { type: 'SET_PRICE';    priceMin: number | undefined; priceMax: number | undefined }
  | { type: 'TOGGLE_STYLE'; style: string }
  | { type: 'TOGGLE_OCCASION'; occasion: string }
  | { type: 'SET_IN_STOCK'; value: boolean }
  | { type: 'RESET' }
  | { type: 'INIT'; filters: ActiveFilters };

function filterReducer(state: ActiveFilters, action: FilterAction): ActiveFilters {
  switch (action.type) {
    case 'SET_METAL':    return { ...state, metal: action.metal };
    case 'TOGGLE_PURITY':
      return {
        ...state,
        purity: state.purity.includes(action.purity)
          ? state.purity.filter((p) => p !== action.purity)
          : [...state.purity, action.purity],
      };
    case 'SET_PRICE':   return { ...state, priceMin: action.priceMin, priceMax: action.priceMax };
    case 'TOGGLE_STYLE':
      return {
        ...state,
        style: state.style.includes(action.style)
          ? state.style.filter((s) => s !== action.style)
          : [...state.style, action.style],
      };
    case 'TOGGLE_OCCASION':
      return {
        ...state,
        occasion: state.occasion.includes(action.occasion)
          ? state.occasion.filter((o) => o !== action.occasion)
          : [...state.occasion, action.occasion],
      };
    case 'SET_IN_STOCK': return { ...state, inStockOnly: action.value };
    case 'RESET':       return { ...EMPTY_FILTERS };
    case 'INIT':        return { ...action.filters };
    default:            return state;
  }
}

// ─── Sort modal (small inline modal) ──────────────────────────────────────────

interface SortModalProps {
  visible:  boolean;
  current:  CatalogSort | undefined;
  onSelect: (sort: CatalogSort) => void;
  onClose:  () => void;
}

export function SortModal({ visible, current, onSelect, onClose }: SortModalProps): React.ReactElement {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(30,36,64,0.4)', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="क्रम मोड बंद करें"
      >
        <View
          style={{
            backgroundColor: SURFACE_ELEVATED,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
            <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <Text style={{
            fontFamily: typography.body.family,
            fontSize: 15, fontWeight: '600',
            color: colors.ink,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
          }}>
            क्रमबद्ध करें
          </Text>
          {CATALOG_SORTS.map((sort) => {
            const isSelected = sort === current;
            return (
              <TouchableOpacity
                key={sort}
                onPress={() => { onSelect(sort); onClose(); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  minHeight: 48,
                  backgroundColor: isSelected ? PRIMARY_WASH : 'transparent',
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={SORT_LABELS[sort]}
              >
                <Text style={{
                  fontFamily: typography.body.family,
                  fontSize: 14,
                  color: isSelected ? PRIMARY_DEEP : colors.ink,
                  fontWeight: isSelected ? '600' : '400',
                  flex: 1,
                }}>
                  {SORT_LABELS[sort]}
                </Text>
                {isSelected && (
                  <Text style={{ color: PRIMARY_DEEP, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main FilterSheet ──────────────────────────────────────────────────────────

export interface FilterSheetProps {
  visible:       boolean;
  initialFilters: ActiveFilters;
  totalCount?:   number;
  onClose:       () => void;
  onApply:       (filters: ActiveFilters) => void;
}

type SectionKey = 'metal' | 'purity' | 'price' | 'style' | 'occasion' | 'inStock';

const SECTION_DEFAULTS: Record<SectionKey, boolean> = {
  metal: true, purity: false, price: false, style: false, occasion: false, inStock: false,
};

export function FilterSheet({
  visible, initialFilters, totalCount, onClose, onApply,
}: FilterSheetProps): React.ReactElement {
  const [draft, dispatch] = useReducer(filterReducer, EMPTY_FILTERS);
  const [expanded, setExpanded] = React.useState<Record<SectionKey, boolean>>(SECTION_DEFAULTS);

  // Sync draft with initialFilters whenever sheet opens
  useEffect(() => {
    if (visible) dispatch({ type: 'INIT', filters: initialFilters });
  }, [visible, initialFilters]);

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const toggleSection = useCallback((key: SectionKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const handleClear = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Scrim */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(30,36,64,0.4)' }}
        onPress={onClose}
        accessibilityLabel="फ़िल्टर बंद करें"
      />
      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '75%',
          backgroundColor: SURFACE_ELEVATED,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          transform: [{ translateY }],
        }}
      >
        {/* Handle bar */}
        <View style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>

        {/* Header row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Text style={{ flex: 1, fontFamily: typography.body.family, fontSize: 17, fontWeight: '700', color: colors.ink }}>
            फ़िल्टर
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: spacing.xs, minHeight: 44, justifyContent: 'center' }}
            accessibilityLabel="फ़िल्टर बंद करें"
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 20, color: colors.inkMute }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* ── Metal ────────────────────────────────────────────────────── */}
          <SectionHeader title="धातु" isOpen={expanded.metal} onToggle={() => toggleSection('metal')} />
          {expanded.metal && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md }}>
              {['', 'GOLD', 'SILVER', 'DIAMOND'].map((val) => {
                const label = val === '' ? 'सभी' : (METAL_FILTER_LABELS[val] ?? val);
                const isSelected = draft.metal === (val || undefined);
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => dispatch({ type: 'SET_METAL', metal: val || undefined })}
                    style={{
                      backgroundColor: isSelected ? PRIMARY_DEEP : colors.white,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: isSelected ? PRIMARY_DEEP : colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`धातु: ${label}`}
                  >
                    <Text style={{
                      fontFamily: typography.body.family, fontSize: 13,
                      color: isSelected ? '#FFFFFF' : colors.ink,
                      fontWeight: isSelected ? '600' : '400',
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Purity ───────────────────────────────────────────────────── */}
          <SectionHeader title="शुद्धता" isOpen={expanded.purity} onToggle={() => toggleSection('purity')} />
          {expanded.purity && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md }}>
              {PURITY_ORDER.map((val) => {
                const isChecked = draft.purity.includes(val);
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => dispatch({ type: 'TOGGLE_PURITY', purity: val })}
                    style={{
                      backgroundColor: isChecked ? PRIMARY_WASH : colors.white,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: isChecked ? BORDER_STRONG : colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    accessibilityLabel={PURITY_FILTER_LABELS[val] ?? val}
                  >
                    <Text style={{
                      fontFamily: typography.body.family, fontSize: 13,
                      color: isChecked ? PRIMARY_DEEP : colors.ink,
                      fontWeight: isChecked ? '600' : '400',
                    }}>
                      {PURITY_FILTER_LABELS[val] ?? val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Price ────────────────────────────────────────────────────── */}
          <SectionHeader title="मूल्य" isOpen={expanded.price} onToggle={() => toggleSection('price')} />
          {expanded.price && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md }}>
              {PRICE_BANDS.map((band) => {
                const isSelected =
                  draft.priceMin === band.min && draft.priceMax === band.max;
                return (
                  <TouchableOpacity
                    key={band.labelHi}
                    onPress={() =>
                      dispatch({
                        type: 'SET_PRICE',
                        priceMin: isSelected ? undefined : band.min,
                        priceMax: isSelected ? undefined : band.max,
                      })
                    }
                    style={{
                      backgroundColor: isSelected ? PRIMARY_DEEP : colors.white,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: isSelected ? PRIMARY_DEEP : colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`मूल्य ${band.labelHi}`}
                  >
                    <Text style={{
                      fontFamily: typography.body.family, fontSize: 13,
                      color: isSelected ? '#FFFFFF' : colors.ink,
                      fontWeight: isSelected ? '600' : '400',
                    }}>
                      {band.labelHi}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Style ────────────────────────────────────────────────────── */}
          <SectionHeader title="स्टाइल" isOpen={expanded.style} onToggle={() => toggleSection('style')} />
          {expanded.style && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md }}>
              {CATALOG_STYLES.map((val) => {
                const isChecked = draft.style.includes(val);
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => dispatch({ type: 'TOGGLE_STYLE', style: val })}
                    style={{
                      backgroundColor: isChecked ? PRIMARY_WASH : colors.white,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: isChecked ? BORDER_STRONG : colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    accessibilityLabel={`स्टाइल: ${STYLE_FILTER_LABELS[val] ?? val}`}
                  >
                    <Text style={{
                      fontFamily: typography.body.family, fontSize: 13,
                      color: isChecked ? PRIMARY_DEEP : colors.ink,
                      fontWeight: isChecked ? '600' : '400',
                    }}>
                      {STYLE_FILTER_LABELS[val] ?? val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Occasion ─────────────────────────────────────────────────── */}
          <SectionHeader title="अवसर" isOpen={expanded.occasion} onToggle={() => toggleSection('occasion')} />
          {expanded.occasion && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md }}>
              {CATALOG_OCCASIONS.map((val) => {
                const isChecked = draft.occasion.includes(val);
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => dispatch({ type: 'TOGGLE_OCCASION', occasion: val })}
                    style={{
                      backgroundColor: isChecked ? PRIMARY_WASH : colors.white,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: isChecked ? BORDER_STRONG : colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    accessibilityLabel={`अवसर: ${OCCASION_FILTER_LABELS[val] ?? val}`}
                  >
                    <Text style={{
                      fontFamily: typography.body.family, fontSize: 13,
                      color: isChecked ? PRIMARY_DEEP : colors.ink,
                      fontWeight: isChecked ? '600' : '400',
                    }}>
                      {OCCASION_FILTER_LABELS[val] ?? val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── In Stock ─────────────────────────────────────────────────── */}
          <SectionHeader title="उपलब्धता" isOpen={expanded.inStock} onToggle={() => toggleSection('inStock')} />
          {expanded.inStock && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <Text style={{
                flex: 1,
                fontFamily: typography.body.family, fontSize: 14, color: colors.ink,
              }}>
                केवल उपलब्ध उत्पाद
              </Text>
              <Switch
                value={draft.inStockOnly}
                onValueChange={(v) => dispatch({ type: 'SET_IN_STOCK', value: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={draft.inStockOnly ? '#FFFFFF' : '#FFFFFF'}
                accessibilityLabel="केवल स्टॉक में उत्पाद दिखाएं"
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.inStockOnly }}
              />
            </View>
          )}

          {/* Bottom spacer so last section isn't hidden by action bar */}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Action bar */}
        <View style={{
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: SURFACE_ELEVATED,
        }}>
          <TouchableOpacity
            onPress={handleClear}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
            }}
            accessibilityLabel="सभी फ़िल्टर हटाएं"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink }}>
              सभी हटाएं
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleApply}
            style={{
              flex: 2,
              backgroundColor: colors.primary,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
            }}
            accessibilityLabel="फ़िल्टर लागू करें और उत्पाद देखें"
            accessibilityHint="फ़िल्टर लागू करें और उत्पाद देखें"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
              परिणाम देखें{totalCount !== undefined ? ` (${totalCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
