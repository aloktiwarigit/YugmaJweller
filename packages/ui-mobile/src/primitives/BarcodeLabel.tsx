import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { encodeCode128B } from './code128';

export interface BarcodeLabelProps {
  barcodeValue: string;
  sku: string;
  productName: string;
  weightDisplay: string;
  huid: string | null;
  metal: string;
  purity: string;
  size?: 'standard' | 'compact';
  testID?: string;
}

const MODULE_WIDTH = 1.2; // px per module unit
const CARD_WIDTH = 178; // ~63mm at 72dpi
const CARD_PADDING_STANDARD = 6;
const CARD_PADDING_COMPACT = 4;
const BAR_HEIGHT_STANDARD = 40;
const BAR_HEIGHT_COMPACT = 24;

function BarcodeStrip({
  value,
  barHeight,
  maxWidth,
}: {
  value: string;
  barHeight: number;
  maxWidth: number;
}): React.JSX.Element {
  const encoded = useMemo(() => {
    try {
      return encodeCode128B(value);
    } catch {
      return null;
    }
  }, [value]);

  if (encoded == null || encoded.widths.length === 0) {
    return <View style={[styles.stripError, { height: barHeight }]} />;
  }

  const moduleWidth = Math.min(MODULE_WIDTH, maxWidth / encoded.totalModules);

  return (
    <View style={[styles.stripRow, { width: maxWidth, height: barHeight }]} accessibilityLabel={`Barcode: ${value}`}>
      {encoded.widths.map((w, i) => (
        <View
          key={i}
          style={{
            width: w * moduleWidth,
            height: barHeight,
            backgroundColor: i % 2 === 0 ? '#000000' : '#FFFFFF',
          }}
        />
      ))}
    </View>
  );
}

export function BarcodeLabel({
  barcodeValue,
  sku,
  productName,
  weightDisplay,
  huid,
  metal,
  purity,
  size = 'standard',
  testID,
}: BarcodeLabelProps): React.JSX.Element {
  const isCompact = size === 'compact';
  const barHeight = isCompact ? BAR_HEIGHT_COMPACT : BAR_HEIGHT_STANDARD;
  const horizontalPadding = isCompact ? CARD_PADDING_COMPACT : CARD_PADDING_STANDARD;
  const maxBarcodeWidth = CARD_WIDTH - horizontalPadding * 2;

  return (
    <View style={[styles.card, isCompact && styles.cardCompact]} testID={testID}>
      <BarcodeStrip value={barcodeValue} barHeight={barHeight} maxWidth={maxBarcodeWidth} />

      <View style={styles.labelRow}>
        <Text style={styles.skuText} numberOfLines={1}>
          {sku}
        </Text>
        <Text style={styles.weightText}>{weightDisplay}</Text>
      </View>

      {!isCompact && (
        <>
          {productName !== sku && (
            <Text style={styles.nameText} numberOfLines={1}>
              {productName}
            </Text>
          )}
          <Text style={styles.metaText}>
            {metal} · {purity}
          </Text>
          {huid != null && (
            <Text style={styles.huidText} testID={testID ? `${testID}-huid` : undefined}>
              HUID: {huid}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0C8B8',
    borderRadius: 4,
    padding: CARD_PADDING_STANDARD,
    margin: 4,
  },
  cardCompact: {
    padding: CARD_PADDING_COMPACT,
  },
  stripRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  stripError: {
    backgroundColor: '#EEE',
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
  },
  skuText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  weightText: {
    fontSize: 10,
    color: '#444444',
    marginLeft: 4,
  },
  nameText: {
    fontSize: 10,
    color: '#555555',
    marginTop: 1,
  },
  metaText: {
    fontSize: 10,
    color: '#555555',
    marginTop: 1,
  },
  huidText: {
    fontSize: 9,
    color: '#777777',
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
