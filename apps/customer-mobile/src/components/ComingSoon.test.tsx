import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ComingSoon } from './ComingSoon';

describe('ComingSoon', () => {
  it('renders the Hindi placeholder', () => {
    const { getByText } = render(<ComingSoon />);
    expect(getByText('जल्द आ रहा है')).toBeTruthy();
  });
});
