import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BarcodeLabel } from '../src/primitives/BarcodeLabel';

const BASE_PROPS = {
  barcodeValue: 'GS-aabbcc-112233445566',
  sku: 'RING-001',
  productName: 'RING-001',
  weightDisplay: '12.4500 g',
  huid: 'AB1234',
  metal: 'GOLD',
  purity: '22K',
};

describe('BarcodeLabel', () => {
  it('renders SKU', () => {
    const { getByText } = render(<BarcodeLabel {...BASE_PROPS} />);
    expect(getByText('RING-001')).toBeTruthy();
  });

  it('renders weight display', () => {
    const { getByText } = render(<BarcodeLabel {...BASE_PROPS} />);
    expect(getByText('12.4500 g')).toBeTruthy();
  });

  it('renders metal and purity in standard mode', () => {
    const { getByText } = render(<BarcodeLabel {...BASE_PROPS} />);
    expect(getByText('GOLD · 22K')).toBeTruthy();
  });

  it('renders HUID element when huid is provided', () => {
    const { getByTestId } = render(<BarcodeLabel {...BASE_PROPS} testID="lbl" />);
    expect(getByTestId('lbl-huid')).toBeTruthy();
  });

  it('hides HUID element when huid is null', () => {
    const { queryByTestId } = render(<BarcodeLabel {...BASE_PROPS} huid={null} testID="lbl" />);
    expect(queryByTestId('lbl-huid')).toBeNull();
  });

  it('compact mode omits metal/purity line', () => {
    const { queryByText } = render(<BarcodeLabel {...BASE_PROPS} size="compact" />);
    expect(queryByText('GOLD · 22K')).toBeNull();
  });

  it('compact mode omits HUID element', () => {
    const { queryByTestId } = render(<BarcodeLabel {...BASE_PROPS} size="compact" testID="lbl" />);
    expect(queryByTestId('lbl-huid')).toBeNull();
  });

  it('compact mode still renders SKU and weight', () => {
    const { getByText } = render(<BarcodeLabel {...BASE_PROPS} size="compact" />);
    expect(getByText('RING-001')).toBeTruthy();
    expect(getByText('12.4500 g')).toBeTruthy();
  });
});
