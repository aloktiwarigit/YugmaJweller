import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DailySummaryCard } from '../src/business/DailySummaryCard';

describe('DailySummaryCard', () => {
  const baseProps = {
    label: 'अंगूठी',
    count: 5,
    weightG: '45.2500 g',
    value: '₹2,71,500.00',
  };

  it('renders label, count, weight and value', () => {
    const { getByText } = render(<DailySummaryCard {...baseProps} />);
    expect(getByText('अंगूठी')).toBeTruthy();
    expect(getByText('5 नग')).toBeTruthy();
    expect(getByText('45.2500 g')).toBeTruthy();
    expect(getByText('₹2,71,500.00')).toBeTruthy();
  });

  it('renders with GOLD metal type', () => {
    const { getByTestId } = render(<DailySummaryCard {...baseProps} metal="GOLD" />);
    expect(getByTestId('daily-summary-card')).toBeTruthy();
  });

  it('renders with SILVER metal type', () => {
    const { getByTestId } = render(<DailySummaryCard {...baseProps} metal="SILVER" />);
    expect(getByTestId('daily-summary-card')).toBeTruthy();
  });

  it('renders without metal type', () => {
    const { getByTestId } = render(<DailySummaryCard {...baseProps} />);
    expect(getByTestId('daily-summary-card')).toBeTruthy();
  });
});
