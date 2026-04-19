import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../src/primitives/Button';

describe('Button', () => {
  it('renders the provided label', () => {
    const { getByText } = render(<Button label="आगे बढ़ें" />);
    expect(getByText('आगे बढ़ें')).toBeTruthy();
  });

  it('has a touch target ≥48×48', () => {
    const { getByTestId } = render(<Button label="X" testID="btn" />);
    expect(getByTestId('btn')).toHaveMinTouchTarget();
  });

  it('primary variant uses aged-gold background', () => {
    const { getByTestId } = render(<Button label="X" testID="btn" variant="primary" />);
    const el = getByTestId('btn');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['backgroundColor']).toBe('#B58A3C');
  });

  it('secondary variant has transparent background', () => {
    const { getByTestId } = render(<Button label="X" testID="btn" variant="secondary" />);
    const el = getByTestId('btn');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['backgroundColor']).toBe('transparent');
  });

  it('disabled variant reduces opacity + blocks press', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(<Button label="X" testID="btn" disabled onPress={onPress} />);
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading variant blocks press', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(<Button label="X" testID="btn" loading onPress={onPress} />);
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
