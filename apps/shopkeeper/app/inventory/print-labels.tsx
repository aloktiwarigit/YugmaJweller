import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import axios from 'axios';
import { BarcodeLabel } from '@goldsmith/ui-mobile';
import { encodeCode128B } from '@goldsmith/ui-mobile';
import type { BarcodeData } from '@goldsmith/shared';
import { api } from '../../src/api/client';

function barcodeSvg(value: string, height: number): string {
  let widths: number[];
  try {
    widths = encodeCode128B(value).widths;
  } catch {
    return `<rect width="160" height="${height}" fill="#eee"/>`;
  }

  const moduleWidth = 1.4;
  let x = 0;
  const bars: string[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) {
      bars.push(`<rect x="${x.toFixed(2)}" y="0" width="${(w * moduleWidth).toFixed(2)}" height="${height}" fill="#000"/>`);
    }
    x += w * moduleWidth;
  });
  const totalWidth = x.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">${bars.join('')}</svg>`;
}

function buildPrintHtml(items: BarcodeData[]): string {
  const labelWidth = '63mm';
  const labelHeight = '38mm';
  const labelsHtml = items
    .map(
      (item) => `
    <div class="label">
      <div class="barcode">${barcodeSvg(item.barcodeValue, 45)}</div>
      <div class="sku-row">
        <span class="sku">${item.sku}</span>
        <span class="weight">${item.weightDisplay}</span>
      </div>
      <div class="meta">${item.metal} · ${item.purity}</div>
      ${item.huid ? `<div class="huid">HUID: ${item.huid}</div>` : ''}
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; font-family: sans-serif; }
  .grid { display: flex; flex-wrap: wrap; gap: 4mm; }
  .label {
    width: ${labelWidth};
    height: ${labelHeight};
    border: 0.5px solid #ccc;
    border-radius: 2mm;
    padding: 2mm;
    box-sizing: border-box;
    overflow: hidden;
  }
  .barcode { display: flex; justify-content: center; margin-bottom: 1mm; }
  .barcode svg { max-width: 100%; }
  .sku-row { display: flex; justify-content: space-between; align-items: baseline; }
  .sku { font-size: 9pt; font-weight: bold; }
  .weight { font-size: 8pt; color: #555; }
  .meta { font-size: 8pt; color: #555; margin-top: 0.5mm; }
  .huid { font-size: 7pt; color: #777; font-family: monospace; margin-top: 0.5mm; }
</style>
</head>
<body>
<div class="grid">${labelsHtml}</div>
</body>
</html>`;
}

export default function PrintLabelsScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ productIds?: string }>();
  const productIds = params.productIds ? (params.productIds as string).split(',') : [];

  const [barcodes, setBarcodes] = useState<BarcodeData[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (productIds.length === 0) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const response = await api.post<BarcodeData[]>(
          '/api/v1/inventory/products/barcodes',
          { productIds },
        );
        if (!mountedRef.current) return;
        setBarcodes(response.data);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        // Partial success: collect failed IDs from error response if available
        if (
          axios.isAxiosError(err) &&
          err.response?.data?.productId
        ) {
          const failedId = err.response.data.productId as string;
          setFailedIds([failedId]);
          const retryIds = productIds.filter((id) => id !== failedId);
          if (retryIds.length > 0) {
            try {
              const retryResp = await api.post<BarcodeData[]>(
                '/api/v1/inventory/products/barcodes',
                { productIds: retryIds },
              );
              if (!mountedRef.current) return;
              setBarcodes(retryResp.data);
            } catch {
              // best effort
            }
          }
        } else {
          setFailedIds(productIds);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = async (): Promise<void> => {
    if (barcodes.length === 0) return;
    setPrinting(true);
    try {
      const html = buildPrintHtml(barcodes);
      await Print.printAsync({ html });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5E3C" />
        <Text style={styles.loadingText}>लेबल तैयार हो रहे हैं...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {failedIds.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {failedIds.length} उत्पाद नहीं मिले। शेष लेबल दिखाए जा रहे हैं।
          </Text>
        </View>
      )}

      {barcodes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>कोई लेबल उपलब्ध नहीं है।</Text>
        </View>
      ) : (
        <>
          <Text style={styles.readyText}>प्रिंट के लिए तैयार — {barcodes.length} लेबल</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {barcodes.map((item) => (
              <BarcodeLabel key={item.barcodeValue} {...item} testID={`label-${item.sku}`} />
            ))}
          </ScrollView>
          <Pressable
            style={[styles.printButton, printing && styles.printButtonDisabled]}
            onPress={() => void handlePrint()}
            disabled={printing}
            accessibilityRole="button"
            accessibilityLabel="लेबल प्रिंट करें"
          >
            <Text style={styles.printButtonText}>
              {printing ? 'प्रिंट हो रहा है...' : 'लेबल प्रिंट करें'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDDD',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#5A3E28',
    fontFamily: 'NotoSansDevanagari',
  },
  emptyText: {
    fontSize: 16,
    color: '#5A3E28',
    fontFamily: 'NotoSansDevanagari',
  },
  readyText: {
    fontSize: 14,
    color: '#5A3E28',
    fontFamily: 'NotoSansDevanagari',
    padding: 12,
    paddingBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  errorBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'NotoSansDevanagari',
  },
  printButton: {
    margin: 16,
    backgroundColor: '#8B5E3C',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  printButtonDisabled: {
    opacity: 0.5,
  },
  printButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'NotoSansDevanagari',
    fontWeight: '600',
  },
});
