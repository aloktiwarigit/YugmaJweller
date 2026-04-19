import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Input } from '../src/primitives/Input';

describe('Input', () => {
  it('has a touch target ≥48×48', () => {
    const { getByTestId } = render(
      <Input value="" onChangeText={vi.fn()} testID="input" />,
    );
    expect(getByTestId('input')).toHaveMinTouchTarget();
  });

  it('renders with provided value', () => {
    const { getByTestId } = render(
      <Input value="हिंदी" onChangeText={vi.fn()} testID="input" />,
    );
    const el = getByTestId('input') as HTMLInputElement;
    expect(el.getAttribute('value')).toBe('हिंदी');
  });

  it('calls onChangeText when text changes', () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <Input value="" onChangeText={handler} testID="input" />,
    );
    fireEvent.change(getByTestId('input'), { target: { value: 'नया पाठ' } });
    expect(handler).toHaveBeenCalledWith('नया पाठ');
  });

  it('passes keyboardType through to underlying element', () => {
    const { getByTestId } = render(
      <Input value="" onChangeText={vi.fn()} keyboardType="numeric" testID="input" />,
    );
    const el = getByTestId('input');
    expect(el.getAttribute('keyboardtype')).toBe('numeric');
  });

  it('passes accessibilityLabel through', () => {
    const { getByTestId } = render(
      <Input value="" onChangeText={vi.fn()} accessibilityLabel="फ़ोन नंबर" testID="input" />,
    );
    const el = getByTestId('input');
    expect(el.getAttribute('accessibilitylabel')).toBe('फ़ोन नंबर');
  });
});
