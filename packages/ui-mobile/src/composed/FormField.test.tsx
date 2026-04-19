import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders label and input', () => {
    render(<FormField label="नाम" value="" onChangeText={() => undefined} testID="name-field" />);
    expect(screen.getByText('नाम')).toBeTruthy();
    expect(screen.getByTestId('name-field-input')).toBeTruthy();
  });

  it('renders error message when provided', () => {
    render(
      <FormField
        label="नाम"
        value=""
        onChangeText={() => undefined}
        error="यह field ज़रूरी है"
        testID="name-field"
      />,
    );
    expect(screen.getByText('यह field ज़रूरी है')).toBeTruthy();
  });

  it('does not render error node when error is absent', () => {
    render(<FormField label="नाम" value="" onChangeText={() => undefined} testID="name-field" />);
    expect(screen.queryByTestId('name-field-error')).toBeNull();
  });

  it('has min touch target height of 48 on the input', () => {
    render(<FormField label="नाम" value="" onChangeText={() => undefined} testID="name-field" />);
    const input = screen.getByTestId('name-field-input');
    expect(input).toHaveMinTouchTarget();
  });
});
