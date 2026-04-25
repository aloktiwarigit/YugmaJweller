import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InvoiceLineItem } from '../src/business/InvoiceLineItem';
import type { InvoiceItemResponse } from '@goldsmith/shared';

const ITEM: InvoiceItemResponse = {
  id: '00000000-0000-4000-8000-000000000001',
  productId: '00000000-0000-4000-8000-000000000002',
  description: 'Gold Chain 22K',
  hsnCode: '7113',
  huid: 'AB12CD',
  metalType: 'GOLD',
  purity: 'GOLD_22K',
  netWeightG: '10.0000',
  ratePerGramPaise: '684200',
  makingChargePct: '12.00',
  goldValuePaise:    '6842000',
  makingChargePaise: '821040',
  stoneChargesPaise: '0',
  hallmarkFeePaise:  '0',
  gstMetalPaise:     '205260',
  gstMakingPaise:    '41052',
  lineTotalPaise:    '7909352',
  sortOrder: 0,
};

describe('InvoiceLineItem', () => {
  it('renders the description', () => {
    const { getByText } = render(<InvoiceLineItem item={ITEM} />);
    expect(getByText('Gold Chain 22K')).toBeTruthy();
  });

  it('renders the HUID when present', () => {
    const { getByText } = render(<InvoiceLineItem item={ITEM} />);
    expect(getByText('HUID: AB12CD')).toBeTruthy();
  });

  it('hides HUID when null', () => {
    const { queryByText } = render(<InvoiceLineItem item={{ ...ITEM, huid: null }} />);
    expect(queryByText(/HUID:/)).toBeNull();
  });

  it('shows weight + purity', () => {
    const { getByText } = render(<InvoiceLineItem item={ITEM} />);
    expect(getByText(/10\.0000 ग्राम · GOLD_22K/)).toBeTruthy();
  });

  it('formats line total in Indian Rupees with thousands separator', () => {
    const { getByText } = render(<InvoiceLineItem item={ITEM} />);
    // 7909352 paise = ₹79,093.52
    expect(getByText('₹79,093.52')).toBeTruthy();
  });
});
