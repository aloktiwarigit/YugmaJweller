import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineCard } from './TimelineCard';

describe('TimelineCard', () => {
  it('renders title and sub-line', () => {
    const { getByTestId } = render(
      <TimelineCard
        status="COMPLETED"
        title="INV-001"
        subLine="₹2,500"
        date="01 May 2026"
      />,
    );
    expect(getByTestId('timeline-card-title').textContent).toBe('INV-001');
    expect(getByTestId('timeline-card-subline').textContent).toBe('₹2,500');
  });

  it('status chip shows correct Hindi label for COMPLETED', () => {
    const { getByTestId } = render(
      <TimelineCard status="COMPLETED" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('पूर्ण');
  });

  it('status chip shows correct Hindi label for PENDING_PAYMENT', () => {
    const { getByTestId } = render(
      <TimelineCard status="PENDING_PAYMENT" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('लंबित');
  });

  it('status chip shows correct Hindi label for ACTIVE', () => {
    const { getByTestId } = render(
      <TimelineCard status="ACTIVE" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('सक्रिय');
  });

  it('status chip shows correct Hindi label for CANCELLED', () => {
    const { getByTestId } = render(
      <TimelineCard status="CANCELLED" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('रद्द');
  });

  it('status chip shows correct Hindi label for IN_TRY_AT_HOME', () => {
    const { getByTestId } = render(
      <TimelineCard status="IN_TRY_AT_HOME" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('जारी है');
  });

  it('does not contain the string Goldsmith (white-label invariant)', () => {
    const { container } = render(
      <TimelineCard status="COMPLETED" title="Test" subLine="Test" date="01 May 2026" />,
    );
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });
});
