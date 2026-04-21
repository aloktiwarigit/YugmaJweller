import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLockDurationPicker } from '../src/features/settings/components/RateLockDurationPicker';

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'Medium' },
}));

vi.mock('@goldsmith/i18n', () => ({
  t: (key: string) => key,
}));

describe('RateLockDurationPicker', () => {
  let onSave: ReturnType<typeof vi.fn<[number], Promise<void>>>;

  beforeEach(() => {
    onSave = vi.fn<[number], Promise<void>>().mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders the initial days value', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    expect(getByTestId('rate-lock-value').textContent).toBe('7');
  });

  it('increments value on + tap', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    expect(getByTestId('rate-lock-value').textContent).toBe('8');
  });

  it('decrements value on − tap', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-decrement'));
    expect(getByTestId('rate-lock-value').textContent).toBe('6');
  });

  it('clamps at max 30 — value does not exceed 30', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={30} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    expect(getByTestId('rate-lock-value').textContent).toBe('30');
  });

  it('clamps at min 1 — value does not go below 1', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={1} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-decrement'));
    expect(getByTestId('rate-lock-value').textContent).toBe('1');
  });

  it('does not call onSave immediately after tap', () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with new value after 1 second debounce', async () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(onSave).toHaveBeenCalledWith(8);
  });

  it('resets debounce on rapid taps — only calls onSave once with final value', async () => {
    const { getByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment')); // 8
    fireEvent.click(getByTestId('rate-lock-increment')); // 9
    fireEvent.click(getByTestId('rate-lock-increment')); // 10
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(10);
  });

  it('shows success message after save completes', async () => {
    const { getByTestId, queryByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    await act(async () => {
      vi.advanceTimersByTime(1000);
      // Allow the async save() to complete (two awaits: onSave + Haptics)
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(queryByTestId('rate-lock-success')).toBeTruthy();
  });

  it('shows error message when save fails', async () => {
    onSave.mockRejectedValueOnce(new Error('network'));
    const { getByTestId, queryByTestId } = render(
      <RateLockDurationPicker days={7} onSave={onSave} />,
    );
    fireEvent.click(getByTestId('rate-lock-increment'));
    await act(async () => {
      vi.advanceTimersByTime(1000);
      // Allow the async save() rejection to propagate
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(queryByTestId('rate-lock-error')).toBeTruthy();
  });
});
