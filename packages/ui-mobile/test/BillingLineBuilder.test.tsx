import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BillingLineBuilder } from '../src/business/BillingLineBuilder';

const PRODUCT = {
  id: 'p1',
  metal: 'GOLD',
  purity: 'GOLD_22K',
  netWeightG: '10.0000',
  huid: 'AB12CD',
  description: 'Gold Chain 22K',
};

describe('BillingLineBuilder', () => {
  it('renders product description and weight in Hindi', () => {
    const { getByText } = render(
      <BillingLineBuilder
        product={PRODUCT}
        ratePerGramPaise={684_200n}
        makingChargePct="12.00"
        onChange={() => {}}
      />,
    );
    expect(getByText('Gold Chain 22K')).toBeTruthy();
    expect(getByText(/10\.0000 ग्राम/)).toBeTruthy();
  });

  it('shows HUID field with the stored value (read-only display)', () => {
    const { getByText } = render(
      <BillingLineBuilder
        product={PRODUCT}
        ratePerGramPaise={684_200n}
        makingChargePct="12.00"
        onChange={() => {}}
      />,
    );
    expect(getByText('HUID: AB12CD')).toBeTruthy();
  });

  it('does not show HUID line when product is not hallmarked', () => {
    const noHuidProduct = { ...PRODUCT, huid: null };
    const { queryByText } = render(
      <BillingLineBuilder
        product={noHuidProduct}
        ratePerGramPaise={684_200n}
        makingChargePct="12.00"
        onChange={() => {}}
      />,
    );
    expect(queryByText(/HUID:/)).toBeNull();
  });

  it('emits onChange when making% is edited', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <BillingLineBuilder
        product={PRODUCT}
        ratePerGramPaise={684_200n}
        makingChargePct="12.00"
        onChange={onChange}
      />,
    );
    fireEvent.change(getByTestId('making-pct-input'), { target: { value: '15.00' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ makingChargePct: '15.00' }),
    );
  });
});
