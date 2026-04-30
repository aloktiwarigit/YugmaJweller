import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

describe('app shell smoke', () => {
  it('renders a hello marker', () => {
    function Hello(): React.ReactElement {
      return <span data-testid="hello">customer-mobile-ok</span>;
    }
    const { getByTestId } = render(<Hello />);
    expect(getByTestId('hello').textContent).toBe('customer-mobile-ok');
  });
});
