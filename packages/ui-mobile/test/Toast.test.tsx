import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Toast } from '../src/primitives/Toast';

describe('Toast', () => {
  it('renders the provided message', () => {
    const { getByText } = render(<Toast message="सफलता!" />);
    expect(getByText('सफलता!')).toBeTruthy();
  });

  it('has accessibilityRole=alert', () => {
    const { getByTestId } = render(<Toast message="X" testID="toast" />);
    // accessibilityRole is passed as an HTML attribute (lowercased by React DOM)
    expect(getByTestId('toast').getAttribute('accessibilityrole')).toBe('alert');
  });

  it('error variant uses error color background', () => {
    const { getByTestId } = render(
      <Toast message="त्रुटि" variant="error" testID="toast" />,
    );
    const el = getByTestId('toast') as HTMLElement;
    expect(el.style.backgroundColor).toBe('rgb(177, 64, 43)'); // #B1402B
  });

  it('info variant uses ink color background', () => {
    const { getByTestId } = render(
      <Toast message="जानकारी" variant="info" testID="toast" />,
    );
    const el = getByTestId('toast') as HTMLElement;
    expect(el.style.backgroundColor).toBe('rgb(30, 36, 64)'); // #1E2440
  });

  it('has minHeight ≥48', () => {
    const { getByTestId } = render(<Toast message="X" testID="toast" />);
    const el = getByTestId('toast') as HTMLElement;
    // Toast is a display element, not a tap target — it only requires minHeight ≥48
    expect(parseFloat(el.style.minHeight)).toBeGreaterThanOrEqual(48);
  });
});
