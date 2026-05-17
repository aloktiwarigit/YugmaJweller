import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineReviews } from './TimelineReviews';

describe('TimelineReviews', () => {
  it('renders a production-safe Hindi empty state', () => {
    const { getByTestId, container } = render(<TimelineReviews />);
    expect(getByTestId('timeline-reviews-placeholder')).toBeTruthy();
    expect(container.textContent).toContain('अभी कोई समीक्षा नहीं');
    expect(container.textContent).toContain('समीक्षा');
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it('does not leak the platform brand name (white-label invariant)', () => {
    const { container } = render(<TimelineReviews />);
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });
});
