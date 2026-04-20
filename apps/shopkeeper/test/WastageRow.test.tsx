import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';
import { WastageRow } from '../src/features/settings/components/WastageRow';

beforeEach(() => {
  setLocale('hi-IN');
});

describe('WastageRow', () => {
  it('renders percent input with testID "percent-input"', () => {
    const { getByTestId } = render(
      <WastageRow

        percent="15.00"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    expect(getByTestId('percent-input')).toBeTruthy();
  });

  it('renders category label', () => {
    const { getByText } = render(
      <WastageRow

        percent="15.00"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    expect(getByText('अंगूठी')).toBeTruthy();
  });

  it('shows VALUE_FORMAT_INVALID error for non-numeric input', () => {
    const { getByTestId, getByText } = render(
      <WastageRow

        percent="abc"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    fireEvent.blur(getByTestId('percent-input'));
    expect(getByText('कृपया सही संख्या डालें')).toBeTruthy();
  });

  it('shows VALUE_POSITIVE_REQUIRED error for zero input', () => {
    const { getByTestId, getByText } = render(
      <WastageRow

        percent="0"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    fireEvent.blur(getByTestId('percent-input'));
    expect(getByText('घटत 0 से ज़्यादा होनी चाहिए')).toBeTruthy();
  });

  it('shows wastage_high error for input > 30', () => {
    const { getByTestId, getByText } = render(
      <WastageRow

        percent="31"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    fireEvent.blur(getByTestId('percent-input'));
    expect(getByText('घटत 30% से ज़्यादा नहीं होनी चाहिए — कृपया सही मात्रा डालें')).toBeTruthy();
  });

  it('accepts input exactly at 30 (no error)', () => {
    const { getByTestId, queryByText } = render(
      <WastageRow

        percent="30"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    fireEvent.blur(getByTestId('percent-input'));
    expect(queryByText('घटत 30% से ज़्यादा नहीं होनी चाहिए — कृपया सही मात्रा डालें')).toBeNull();
  });

  it('calls onSave with trimmed string value on valid save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <WastageRow

        percent="15.00"
        label="अंगूठी"
        onSave={onSave}
      />,
    );
    fireEvent.change(getByTestId('percent-input'), { target: { value: '  20.50  ' } });
    fireEvent.click(getByTestId('save-btn'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('20.50'));
  });

  it('shows success text for 2 seconds then hides it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers();
    const { getByTestId, getByText, queryByText } = render(
      <WastageRow

        percent="15.00"
        label="अंगूठी"
        onSave={onSave}
      />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('save-btn'));
    });
    expect(getByText('बदलाव सहेज लिया ✓')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(queryByText('बदलाव सहेज लिया ✓')).toBeNull();
    vi.useRealTimers();
  });

  it('does NOT render toggle-percent or toggle-fixed testIDs', () => {
    const { queryByTestId } = render(
      <WastageRow

        percent="15.00"
        label="अंगूठी"
        onSave={vi.fn()}
      />,
    );
    expect(queryByTestId('toggle-percent')).toBeNull();
    expect(queryByTestId('toggle-fixed')).toBeNull();
  });
});
