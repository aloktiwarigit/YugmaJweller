import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';
import type { MakingChargeConfig } from '@goldsmith/shared';
import { MakingChargeRow } from '../src/features/settings/components/MakingChargeRow';

beforeEach(() => {
  setLocale('hi-IN');
});

const baseConfig: MakingChargeConfig = {
  category: 'RINGS',
  type: 'percent',
  value: '12.00',
};

describe('MakingChargeRow', () => {
  it('renders category label in Hindi', () => {
    const { getByText } = render(
      <MakingChargeRow config={baseConfig} onChange={vi.fn()} />,
    );
    expect(getByText('अंगूठी')).toBeTruthy(); // RINGS in hi-IN
  });

  it('renders current value in the input', () => {
    const { getByDisplayValue } = render(
      <MakingChargeRow config={baseConfig} onChange={vi.fn()} />,
    );
    expect(getByDisplayValue('12.00')).toBeTruthy();
  });

  it('renders percent type label', () => {
    const { getByText } = render(
      <MakingChargeRow config={baseConfig} onChange={vi.fn()} />,
    );
    expect(getByText('प्रतिशत')).toBeTruthy();
  });

  it('calls onChange with type=fixed_per_gram when fixed toggle pressed', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <MakingChargeRow config={baseConfig} onChange={onChange} />,
    );
    fireEvent.click(getByTestId('toggle-fixed'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseConfig,
      type: 'fixed_per_gram',
    });
  });

  it('calls onChange with updated value on input change', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <MakingChargeRow config={baseConfig} onChange={onChange} />,
    );
    fireEvent.change(getByTestId('value-input'), { target: { value: '15.00' } });
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, value: '15.00' });
  });

  it('shows error for empty value on blur', () => {
    const { getByTestId, getByText } = render(
      <MakingChargeRow config={{ ...baseConfig, value: '' }} onChange={vi.fn()} />,
    );
    fireEvent.blur(getByTestId('value-input'));
    expect(getByText('बनाई का खर्च 0 से ज़्यादा होना चाहिए')).toBeTruthy();
  });

  it('shows error for percent > 100 on blur', () => {
    const { getByTestId, getByText } = render(
      <MakingChargeRow config={{ ...baseConfig, value: '101' }} onChange={vi.fn()} />,
    );
    fireEvent.blur(getByTestId('value-input'));
    expect(getByText('प्रतिशत 100 से ज़्यादा नहीं हो सकता')).toBeTruthy();
  });

  it('calls onChange with type=percent when percent toggle pressed from fixed', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <MakingChargeRow
        config={{ ...baseConfig, type: 'fixed_per_gram' }}
        onChange={onChange}
      />,
    );
    fireEvent.click(getByTestId('toggle-percent'));
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, type: 'percent' });
  });

  it('does NOT show percent error for fixed_per_gram > 100', () => {
    const { getByTestId, queryByText } = render(
      <MakingChargeRow
        config={{ category: 'RINGS', type: 'fixed_per_gram', value: '200' }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.blur(getByTestId('value-input'));
    expect(queryByText('प्रतिशत 100 से ज़्यादा नहीं हो सकता')).toBeNull();
  });
});
