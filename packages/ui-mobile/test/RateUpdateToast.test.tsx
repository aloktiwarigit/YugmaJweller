import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import * as RNMock from './react-native.mock';
import { RateUpdateToast } from '../src/business/RateUpdateToast';

describe('RateUpdateToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(RNMock.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders null when visible=false', () => {
    const { container } = render(
      <RateUpdateToast visible={false} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders default Hindi message when visible=true', () => {
    const { getByText } = render(
      <RateUpdateToast visible={true} onDismiss={vi.fn()} />,
    );
    expect(getByText('आज का भाव अद्यतन हो गया')).toBeTruthy();
  });

  it('renders custom message when provided', () => {
    const { getByText } = render(
      <RateUpdateToast visible={true} onDismiss={vi.fn()} message="भाव बदल गया" />,
    );
    expect(getByText('भाव बदल गया')).toBeTruthy();
  });

  it('calls onDismiss after 2000ms', async () => {
    const onDismiss = vi.fn();
    render(<RateUpdateToast visible={true} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does NOT call onDismiss before 2000ms', async () => {
    const onDismiss = vi.fn();
    render(<RateUpdateToast visible={true} onDismiss={onDismiss} />);

    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('reduced-motion: Animated.parallel is not called when isReduceMotionEnabled=true', async () => {
    vi.spyOn(RNMock.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const parallelSpy = vi.spyOn(RNMock.Animated, 'parallel');
    const setValueSpy = vi.spyOn(RNMock.Animated.Value.prototype, 'setValue');

    await act(async () => {
      render(<RateUpdateToast visible={true} onDismiss={vi.fn()} />);
      // Flush microtasks so the isReduceMotionEnabled promise resolves
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(parallelSpy).not.toHaveBeenCalled();
    // translateY must be reset to 0 so the toast is on-screen (not off at y=80)
    expect(setValueSpy).toHaveBeenCalledWith(0);
  });

  it('animation runs when isReduceMotionEnabled=false', async () => {
    vi.spyOn(RNMock.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const parallelSpy = vi.spyOn(RNMock.Animated, 'parallel');

    await act(async () => {
      render(<RateUpdateToast visible={true} onDismiss={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(parallelSpy).toHaveBeenCalledOnce();
  });

  it('clears timer on unmount (no onDismiss after unmount)', async () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<RateUpdateToast visible={true} onDismiss={onDismiss} />);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('has accessibilityLiveRegion=assertive', () => {
    const { container } = render(
      <RateUpdateToast visible={true} onDismiss={vi.fn()} />,
    );
    const el = container.querySelector('animatedview');
    expect(el?.getAttribute('accessibilityliveregion')).toBe('assertive');
  });
});
