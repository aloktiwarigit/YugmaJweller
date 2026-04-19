import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react-native';
import { Skeleton } from '../src/primitives/Skeleton';

describe('Skeleton', () => {
  it('renders with default dimensions', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    const el = getByTestId('skel');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['height']).toBe(16);
    expect(s['width']).toBe(120);
  });

  it('renders with custom dimensions', () => {
    const { getByTestId } = render(<Skeleton height={80} width={200} testID="skel" />);
    const el = getByTestId('skel');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    expect(s['height']).toBe(80);
    expect(s['width']).toBe(200);
  });

  it('has accessibilityRole=none', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    expect(getByTestId('skel').props['accessibilityRole']).toBe('none');
  });

  it('uses border color for background (no hex literals)', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    const el = getByTestId('skel');
    const s = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : (el.props.style as Record<string, unknown>);
    // colors.border from ui-tokens
    expect(s['backgroundColor']).toBe('#D9C9A8');
  });
});
