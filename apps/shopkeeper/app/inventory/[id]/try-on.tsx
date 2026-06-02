import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Switch,
  type LayoutChangeEvent, type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { clampAnchor } from '../../../src/features/inventory/tryOnPresets';
import { api } from '../../../src/api/client';

interface AssetState {
  assetUrl: string | null;
  anchorX: number;
  anchorY: number;
  status: 'pending' | 'ready' | 'failed';
  enabled: boolean;
}

const NUDGE = 0.02;

export default function TryOnAnchorScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mountedRef = useRef(true);
  const [asset, setAsset] = useState<AssetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<AssetState>(`/api/v1/inventory/products/${id}/try-on-asset`);
        if (mountedRef.current) setAsset(res.data);
      } catch {
        if (mountedRef.current) setAsset(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [id]);

  const setAnchor = useCallback((x: number, y: number) => {
    setAsset((prev) => (prev ? { ...prev, anchorX: clampAnchor(x), anchorY: clampAnchor(y) } : prev));
  }, []);

  const onImagePress = useCallback((e: GestureResponderEvent) => {
    if (box.w === 0 || box.h === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    setAnchor(locationX / box.w, locationY / box.h);
  }, [box, setAnchor]);

  const onSave = useCallback(async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const res = await api.patch<AssetState>(`/api/v1/inventory/products/${id}/try-on-asset`, {
        anchorX: asset.anchorX, anchorY: asset.anchorY, enabled: asset.enabled,
      });
      if (mountedRef.current) {
        setAsset(res.data);
        Alert.alert('', t('inventory.tryon_anchor_saved'));
      }
    } catch {
      Alert.alert('', t('inventory.images_err_generic'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [asset, id]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;

  if (!asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>{t('inventory.tryon_anchor_pending')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('inventory.tryon_anchor_title')}</Text>
      <Text style={styles.hint}>{t('inventory.tryon_anchor_hint')}</Text>

      {asset.status !== 'ready' || !asset.assetUrl ? (
        <Text style={styles.body}>
          {asset.status === 'failed' ? t('inventory.tryon_anchor_failed') : t('inventory.tryon_anchor_pending')}
        </Text>
      ) : (
        <>
          <Pressable
            onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            onPress={onImagePress}
            accessibilityRole="adjustable"
            accessibilityLabel={t('inventory.tryon_anchor_hint')}
            style={styles.canvas}
          >
            <Image source={{ uri: asset.assetUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
            <View
              pointerEvents="none"
              style={[styles.dot, { left: asset.anchorX * box.w - 10, top: asset.anchorY * box.h - 10 }]}
            />
          </Pressable>

          {/* Big nudge buttons — no fine motor control needed */}
          <View style={styles.nudgeGrid}>
            <NudgeBtn label="↑" onPress={() => setAnchor(asset.anchorX, asset.anchorY - NUDGE)} />
            <View style={styles.nudgeRow}>
              <NudgeBtn label="←" onPress={() => setAnchor(asset.anchorX - NUDGE, asset.anchorY)} />
              <NudgeBtn label="→" onPress={() => setAnchor(asset.anchorX + NUDGE, asset.anchorY)} />
            </View>
            <NudgeBtn label="↓" onPress={() => setAnchor(asset.anchorX, asset.anchorY + NUDGE)} />
          </View>

          <View style={styles.enableRow}>
            <Text style={styles.body}>{t('inventory.tryon_anchor_enable')}</Text>
            <Switch
              value={asset.enabled}
              onValueChange={(v) => setAsset((p) => (p ? { ...p, enabled: v } : p))}
              accessibilityLabel={t('inventory.tryon_anchor_enable')}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.tryon_anchor_save')}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>{t('inventory.tryon_anchor_save')}</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

function NudgeBtn({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.nudgeBtn}>
      <Text style={styles.nudgeText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { ...typography.body, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 14, color: colors.textSecondary },
  body: { fontSize: 16, color: colors.textPrimary },
  canvas: {
    width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#F2ECDD', borderWidth: 1, borderColor: colors.border,
  },
  dot: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white,
  },
  nudgeGrid: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  nudgeRow: { flexDirection: 'row', gap: spacing.xl },
  nudgeBtn: {
    minWidth: 56, minHeight: 56, borderRadius: 12, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  nudgeText: { fontSize: 24, color: colors.primary },
  enableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, minHeight: 48 },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12, minHeight: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 18, fontWeight: '600' },
});
