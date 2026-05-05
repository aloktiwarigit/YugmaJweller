import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { TimelineTabBar } from './TimelineTabBar';

describe('TimelineTabBar', () => {
  it('renders all 4 Hindi tab labels', () => {
    const { container } = render(
      <TimelineTabBar activeTab="purchases" onTabChange={vi.fn()} />,
    );
    expect(container.textContent).toContain('खरीदारी');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('दर-लॉक');
    expect(container.textContent).toContain('ट्राई-एट-होम');
  });

  it('active tab has testID timeline-tab-active', () => {
    const { getByTestId } = render(
      <TimelineTabBar activeTab="rate-locks" onTabChange={vi.fn()} />,
    );
    expect(getByTestId('timeline-tab-active').textContent).toBe('दर-लॉक');
  });

  it('calls onTabChange with correct tab id when tapped', () => {
    const onTabChange = vi.fn();
    const { getByTestId } = render(
      <TimelineTabBar activeTab="purchases" onTabChange={onTabChange} />,
    );
    fireEvent.click(getByTestId('timeline-tab-custom-orders'));
    expect(onTabChange).toHaveBeenCalledWith('custom-orders');
  });
});
