import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineReviews } from './TimelineReviews';

describe('TimelineReviews', () => {
  it('renders the Hindi coming-soon placeholder', () => {
    const { getByTestId, container } = render(<TimelineReviews />);
    expect(getByTestId('timeline-reviews-placeholder')).toBeTruthy();
    expect(container.textContent).toContain('जल्द ही उपलब्ध');
    expect(container.textContent).toContain('समीक्षा');
  });

  it('does not leak the platform brand name (white-label invariant)', () => {
    const { container } = render(<TimelineReviews />);
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });
});
