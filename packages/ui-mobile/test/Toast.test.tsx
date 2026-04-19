import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react-native';
import { Toast } from '../src/primitives/Toast';

describe('Toast', () => {
  it('renders the provided message', () => {
    const { getByText } = render(<Toast message="सफलता!" />);
    expect(getByText('सफलता!')).toBeTruthy();
  });

  it('has accessibilityRole=alert', () => {
    const { getByTestId } = render(<Toast message="X" testID="toast" />);
    expect(getByTestId('toast').props['accessibilityRole']).toBe('alert');
  });

  it('error variant uses error color background', () => {
    const { getByTestId } = render(
      <Toast message="त्रुटि" variant="error" testID="toast" />,
    );
    const el = getByTestId('toast');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['backgroundColor']).toBe('#B1402B');
  });

  it('info variant uses ink color background', () => {
    const { getByTestId } = render(
      <Toast message="जानकारी" variant="info" testID="toast" />,
    );
    const el = getByTestId('toast');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['backgroundColor']).toBe('#1E2440');
  });

  it('has minHeight ≥48', () => {
    const { getByTestId } = render(<Toast message="X" testID="toast" />);
    const el = getByTestId('toast');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(typeof s['minHeight'] === 'number' && (s['minHeight'] as number) >= 48).toBe(true);
  });
});
