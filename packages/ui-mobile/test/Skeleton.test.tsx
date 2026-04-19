import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../src/primitives/Skeleton';

describe('Skeleton', () => {
  it('renders with default dimensions', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    const el = getByTestId('skel') as HTMLElement;
    expect(el.style.height).toBe('16px');
    expect(el.style.width).toBe('120px');
  });

  it('renders with custom dimensions', () => {
    const { getByTestId } = render(<Skeleton height={80} width={200} testID="skel" />);
    const el = getByTestId('skel') as HTMLElement;
    expect(el.style.height).toBe('80px');
    expect(el.style.width).toBe('200px');
  });

  it('has accessibilityRole=none', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    expect(getByTestId('skel').getAttribute('accessibilityrole')).toBe('none');
  });

  it('uses border color for background (no hex literals)', () => {
    const { getByTestId } = render(<Skeleton testID="skel" />);
    const el = getByTestId('skel') as HTMLElement;
    // colors.border from ui-tokens = '#D9C9A8' → rgb(217, 201, 168)
    expect(el.style.backgroundColor).toBe('rgb(217, 201, 168)');
  });
});
