/**
 * RootErrorBoundary.test.tsx — component tests for the Hindi error fallback.
 *
 * Story 19.2 AC tested here:
 *  - Renders Hindi fallback when a child throws during render
 *  - Does NOT render children after the error
 *  - Reports to Sentry with errorBoundary: true tag (via withScope mock)
 *  - "रिपोर्ट भेजी गई" confirmation appears after capture
 *  - Retry clears the error state so children re-render
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RootErrorBoundary } from './RootErrorBoundary';

// ── Mock @sentry/react-native ────────────────────────────────────────────────
// The module is mocked globally so tests never need a real DSN.

const mockCaptureException = vi.fn();
const mockSetTag = vi.fn();
const mockSetExtra = vi.fn();
const mockWithScope = vi.fn((cb: (scope: unknown) => void) => {
  cb({ setTag: mockSetTag, setExtra: mockSetExtra });
});

vi.mock('../lib/sentry', () => ({
  Sentry: {
    withScope: (cb: (scope: unknown) => void) => mockWithScope(cb),
    captureException: (err: unknown) => mockCaptureException(err),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A child that throws unconditionally during render */
function ThrowingChild(): React.ReactElement {
  throw new Error('test-render-error');
}

/** A child that renders normally */
function NormalChild(): React.ReactElement {
  return <text>normal content</text>;
}

// Suppress console.error for expected boundary catches so test output is clean
const originalConsoleError = console.error;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress React's internal "the above error occurred in..." logs
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <RootErrorBoundary>
        <NormalChild />
      </RootErrorBoundary>,
    );
    expect(screen.getByText('normal content')).toBeTruthy();
  });

  it('renders Hindi fallback heading when child throws', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    expect(screen.getByText('कुछ गलत हुआ')).toBeTruthy();
    expect(screen.getByText('कृपया ऐप फिर खोलें')).toBeTruthy();
  });

  it('does NOT render normal children after error', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    expect(screen.queryByText('normal content')).toBeNull();
  });

  it('calls Sentry.withScope and captureException when child throws', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    expect(mockWithScope).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const capturedError = mockCaptureException.mock.calls[0][0] as Error;
    expect(capturedError.message).toBe('test-render-error');
  });

  it('sets errorBoundary tag to "true" on the Sentry scope', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    expect(mockSetTag).toHaveBeenCalledWith('errorBoundary', 'true');
  });

  it('shows रिपोर्ट भेजी गई after error is captured', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    // reported becomes true after componentDidCatch → setState
    expect(screen.getByText('✓ रिपोर्ट भेजी गई')).toBeTruthy();
  });

  it('renders retry button text in Hindi', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    // The RN mock renders Pressable as a <pressable> element; we check text content.
    expect(screen.getByText('पुनः प्रयास करें')).toBeTruthy();
  });

  it('clears error state when retry is pressed (re-renders children if no error)', () => {
    // Use a controllable child: throws first render, not second
    let shouldThrow = true;
    function ConditionalThrow(): React.ReactElement {
      if (shouldThrow) throw new Error('first-render-error');
      return <text>recovered</text>;
    }

    const { rerender } = render(
      <RootErrorBoundary>
        <ConditionalThrow />
      </RootErrorBoundary>,
    );

    // Confirm fallback is shown
    expect(screen.getByText('कुछ गलत हुआ')).toBeTruthy();

    // Simulate fix: next render won't throw
    shouldThrow = false;

    // The RN mock renders Pressable as a custom <pressable> element.
    // fireEvent.click works because PressableMock maps onPress to onClick.
    const retryText = screen.getByText('पुनः प्रयास करें');
    fireEvent.click(retryText.parentElement!);

    // After retry, boundary resets and re-renders children
    rerender(
      <RootErrorBoundary>
        <ConditionalThrow />
      </RootErrorBoundary>,
    );
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  it('renders accessibilityrole alert on the fallback container', () => {
    render(
      <RootErrorBoundary>
        <ThrowingChild />
      </RootErrorBoundary>,
    );
    // The RN mock passes accessibilityRole as an attribute (lowercase).
    // jsdom does not recognise it as an ARIA role, but we verify the prop is present.
    const alertEl = document.querySelector('[accessibilityrole="alert"]');
    expect(alertEl).not.toBeNull();
  });
});
