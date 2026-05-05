import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineEmptyState } from './TimelineEmptyState';

describe('TimelineEmptyState', () => {
  it('renders purchases empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="purchases" />);
    expect(container.textContent).toContain('अभी तक कोई खरीदारी नहीं');
    expect(container.textContent).toContain('दुकान पर जाएं');
  });

  it('renders custom-orders empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="custom-orders" />);
    expect(container.textContent).toContain('कोई कस्टम ऑर्डर नहीं');
  });

  it('renders rate-locks empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="rate-locks" />);
    expect(container.textContent).toContain('कोई दर-लॉक नहीं');
  });

  it('renders try-at-home empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="try-at-home" />);
    expect(container.textContent).toContain('कोई ट्राई-एट-होम बुकिंग नहीं');
  });
});
