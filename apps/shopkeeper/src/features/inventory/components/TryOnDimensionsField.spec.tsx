import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';
import { TryOnDimensionsField } from './TryOnDimensionsField';

beforeEach(() => {
  setLocale('hi-IN');
});

describe('TryOnDimensionsField', () => {
  it('emits the chosen body part', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <TryOnDimensionsField value={{ bodyPart: undefined, mm: '' }} onChange={onChange} />,
    );
    fireEvent.click(getByTestId('bodypart-EAR'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bodyPart: 'EAR' }));
  });

  it('shows the mm input only once a body part is chosen', () => {
    const { queryByTestId, rerender } = render(
      <TryOnDimensionsField value={{ bodyPart: undefined, mm: '' }} onChange={vi.fn()} />,
    );
    expect(queryByTestId('tryon-mm-input')).toBeNull();
    rerender(<TryOnDimensionsField value={{ bodyPart: 'FINGER', mm: '' }} onChange={vi.fn()} />);
    expect(queryByTestId('tryon-mm-input')).not.toBeNull();
  });

  it('fills the mm value when a preset chip is tapped', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <TryOnDimensionsField value={{ bodyPart: 'FINGER', mm: '' }} onChange={onChange} />,
    );
    fireEvent.click(getByTestId('preset-16'));
    expect(onChange).toHaveBeenCalledWith({ bodyPart: 'FINGER', mm: '16' });
  });
});
