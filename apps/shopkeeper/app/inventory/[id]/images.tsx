/**
 * Product Image Manager Screen
 *
 * Shopkeeper can upload, reorder (drag), edit alt-text, and delete product
 * images. Consumes the /api/v1/products/:productId/images REST endpoints
 * shipped in Story 17.1 Tasks 1–7.
 *
 * Design rules (CLAUDE.md):
 *  - Touch targets ≥ 48×48dp on every Pressable.
 *  - Min body font 16pt, secondary 14pt.
 *  - High contrast ≥ 4.5:1.
 *  - mountedRef guard for every async state update.
 *  - Idempotency-Key header on every POST upload (F5/F7 fold).
 *  - F6-mobile fold: consume server-built thumbnail_url directly — no local
 *    URL builder or IMAGEKIT_BASE constant.
 *  - F5 fold: explicit ERROR_KEY_MAP instead of mechanical code.toLowerCase().
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { useLocalSearchParams } from 'expo-router';
import { v4 as uuid } from 'uuid';
import { t } from '@goldsmith/i18n';
import { api } from '../../../src/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches the ImageRow returned by GET /api/v1/products/:productId/images.
 *  F6-mobile: thumbnail_url is server-built — never construct ImageKit URLs
 *  client-side. */
type ImageRow = {
  id: string;
  storage_key: string;
  alt_text: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  sort_order: number;
  scan_status: 'pending' | 'clean' | 'rejected';
  /** Server-built ImageKit thumbnail URL (F6-server, Codex P2). */
  thumbnail_url: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// F5 (Codex P2) — explicit error code → i18n key map
// ---------------------------------------------------------------------------

const ERROR_KEY_MAP: Record<string, string> = {
  INVALID_IMAGE:                      'inventory.images_err_invalid_image',
  INVALID_DIMENSIONS:                 'inventory.images_err_invalid_dimensions',
  INVALID_MIME:                       'inventory.images_err_invalid_mime',
  ALT_TEXT_TOO_LONG:                  'inventory.images_err_alt_text_too_long',
  PAYLOAD_TOO_LARGE:                  'inventory.images_err_payload_too_large',
  IMAGE_LIMIT_REACHED:                'inventory.images_err_limit_reached',
  IMAGE_TOO_LARGE_AFTER_COMPRESSION:  'inventory.images_err_too_large_after_compression',
  ORDER_LIST_MISMATCH:                'inventory.images_err_order_mismatch',
  ORDER_LIST_DUPLICATES:              'inventory.images_err_order_duplicates',
  IMAGE_NOT_FOUND:                    'inventory.images_err_not_found',
  SCAN_FAILED:                        'inventory.images_err_scan_failed',
};

function errorMessage(err: unknown): string {
  // Multer 413: no JSON body, inspect HTTP status
  const httpStatus = (err as { response?: { status?: number } }).response?.status;
  if (httpStatus === 413) return t('inventory.images_err_payload_too_large');

  const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
  if (code && ERROR_KEY_MAP[code]) return t(ERROR_KEY_MAP[code]);
  return t('inventory.images_err_generic');
}

// ---------------------------------------------------------------------------
// Screen component
// ---------------------------------------------------------------------------

export default function ProductImagesScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<ImageRow[]>(`/api/v1/products/${id}/images`);
      if (mountedRef.current) setImages(res.data);
    } catch (err: unknown) {
      if (mountedRef.current) Alert.alert(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      if (mountedRef.current) setLoading(true);
      await refresh();
      if (mountedRef.current) setLoading(false);
    })();
  }, [refresh]);

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  const onAdd = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.95,
    });
    if (picker.canceled || picker.assets.length === 0) return;

    const asset = picker.assets[0];
    if (!asset) return;

    if (mountedRef.current) setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'image.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      // F7 fold: idempotency key prevents duplicate rows on retry
      const idempotencyKey = uuid();

      await api.post(`/api/v1/products/${id}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': idempotencyKey,
        },
      });
      await refresh();
    } catch (err: unknown) {
      Alert.alert(errorMessage(err));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, [id, refresh]);

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const onDelete = useCallback(
    async (imageId: string) => {
      setConfirmDeleteId(null);
      try {
        await api.delete(`/api/v1/products/${id}/images/${imageId}`);
        if (mountedRef.current) setImages((prev) => prev.filter((img) => img.id !== imageId));
      } catch (err: unknown) {
        Alert.alert(errorMessage(err));
      }
    },
    [id],
  );

  // -------------------------------------------------------------------------
  // Alt-text edit
  // -------------------------------------------------------------------------

  const onAltChange = useCallback(
    async (imageId: string, altText: string) => {
      try {
        await api.patch(`/api/v1/products/${id}/images/${imageId}`, {
          alt_text: altText.trim() || null,
        });
      } catch (err: unknown) {
        Alert.alert(errorMessage(err));
      }
    },
    [id],
  );

  // -------------------------------------------------------------------------
  // Drag reorder
  // -------------------------------------------------------------------------

  const onReorder = useCallback(
    async (newOrder: ImageRow[]) => {
      if (mountedRef.current) setImages(newOrder);
      try {
        await api.patch(`/api/v1/products/${id}/images/order`, {
          orderedIds: newOrder.map((r) => r.id),
        });
      } catch (err: unknown) {
        // Roll back optimistic update
        await refresh();
        Alert.alert(errorMessage(err));
      }
    },
    [id, refresh],
  );

  // -------------------------------------------------------------------------
  // Render item
  // -------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ImageRow>) => (
      <View
        style={[styles.itemRow, isActive && styles.itemRowActive]}
        accessible
        accessibilityLabel={item.alt_text ?? t('inventory.images_alt_placeholder')}
      >
        {/* F6-mobile: use server-built thumbnail_url directly — no imagekitUrl() */}
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.thumbnail}
          contentFit="cover"
          accessibilityLabel={item.alt_text ?? undefined}
        />

        <TextInput
          style={styles.altInput}
          placeholder={t('inventory.images_alt_placeholder')}
          defaultValue={item.alt_text ?? ''}
          onEndEditing={(e) => void onAltChange(item.id, e.nativeEvent.text)}
          maxLength={200}
          returnKeyType="done"
          accessibilityLabel={t('inventory.images_alt_placeholder')}
        />

        {/* Drag handle — 48×48dp touch target */}
        <Pressable
          onPressIn={drag}
          accessibilityLabel="reorder"
          accessibilityRole="button"
          style={styles.dragHandle}
        >
          <Text style={styles.dragIcon}>⋮⋮</Text>
        </Pressable>

        {/* Delete trigger — opens confirm modal */}
        <Pressable
          onPress={() => setConfirmDeleteId(item.id)}
          accessibilityLabel={t('inventory.images_delete_confirm')}
          accessibilityRole="button"
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>
    ),
    [onAltChange],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('inventory.images_title')}</Text>
        <Text style={styles.count}>
          {t('inventory.images_count', { n: images.length })}
        </Text>
      </View>

      {/* Add button */}
      <Pressable
        onPress={() => void onAdd()}
        disabled={uploading || images.length >= 10}
        accessibilityRole="button"
        accessibilityLabel={t('inventory.images_add')}
        style={[
          styles.addBtn,
          (uploading || images.length >= 10) && styles.addBtnDisabled,
        ]}
      >
        {uploading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.addBtnText}>+ {t('inventory.images_add')}</Text>
        )}
      </Pressable>

      {/* Loading state */}
      {loading && (
        <ActivityIndicator style={styles.loader} color="#15803d" />
      )}

      {/* Draggable list */}
      {!loading && (
        <DraggableFlatList
          data={images}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => void onReorder(data)}
          containerStyle={styles.listContainer}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        visible={!!confirmDeleteId}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmDeleteId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t('inventory.images_delete_confirm')}
            </Text>

            <Pressable
              onPress={() => {
                if (confirmDeleteId) void onDelete(confirmDeleteId);
              }}
              accessibilityRole="button"
              style={styles.modalDeleteBtn}
            >
              <Text style={styles.modalDeleteBtnText}>
                {t('inventory.images_delete_yes')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setConfirmDeleteId(null)}
              accessibilityRole="button"
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>
                {t('inventory.images_delete_no')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — 48dp touch targets, 16pt min body, ≥ 4.5:1 contrast
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#171717', // 4.5:1 on white
  },
  count: {
    fontSize: 14,
    color: '#404040', // secondary text, ≥ 4.5:1 on white
  },
  addBtn: {
    backgroundColor: '#15803d',
    borderRadius: 6,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnDisabled: {
    backgroundColor: '#a3a3a3',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 32,
  },
  listContainer: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#ffffff',
  },
  itemRowActive: {
    opacity: 0.75,
    backgroundColor: '#f5f5f5',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#e5e5e5',
  },
  altInput: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
    minHeight: 48,
    color: '#171717',
    paddingVertical: 8,
  },
  dragHandle: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIcon: {
    fontSize: 20,
    color: '#737373',
    letterSpacing: 2,
  },
  deleteBtn: {
    minWidth: 48,
    minHeight: 48,
    backgroundColor: '#dc2626',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 24,
    lineHeight: 26,
  },
  modalDeleteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDeleteBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelBtn: {
    borderWidth: 1.5,
    borderColor: '#a3a3a3',
    borderRadius: 6,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 16,
    color: '#404040',
  },
});
