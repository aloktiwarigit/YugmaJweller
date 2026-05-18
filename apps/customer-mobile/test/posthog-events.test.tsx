/**
 * posthog-events.test.tsx — Integration test: ReviewSubmitForm fires review_submit event.
 *
 * Verifies: selecting a rating and submitting fires captureEvent with the correct
 * event name, productId, rating, and no PII properties.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock posthog lib so we can assert captureEvent was called
vi.mock('../src/lib/posthog', () => ({
  captureEvent:     vi.fn(),
  identifyPostHog:  vi.fn(),
  initPostHog:      vi.fn(() => null),
  getPostHog:       vi.fn(() => null),
  hashPhone:        vi.fn().mockResolvedValue('abc123def456'),
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate:     vi.fn(),
    isPending:  false,
    isError:    false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock endpoints
vi.mock('../src/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    submitCustomerReview: vi.fn().mockResolvedValue({ id: 'review-1' }),
  };
});

// Mock useCustomerSession
vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: vi.fn(() => ({
    isAuthenticated: true,
    customer: { id: 'cust-1', shopId: 'shop-abc', phoneE164: '+919876543210', name: 'Test' },
    signOut: vi.fn(),
  })),
}));

import { captureEvent } from '../src/lib/posthog';
import { useMutation } from '@tanstack/react-query';
import { ReviewSubmitForm } from '../src/components/ReviewSubmitForm';

const mockCaptureEvent = vi.mocked(captureEvent);

describe('ReviewSubmitForm — PostHog event', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders star buttons and submit button', () => {
    const { getByTestId } = render(<ReviewSubmitForm productId="prod-1" />);
    // TouchableOpacity is mapped to PressableMock (renders as <pressable> with data-testid)
    expect(getByTestId('star-1')).toBeTruthy();
    expect(getByTestId('star-5')).toBeTruthy();
    expect(getByTestId('submit-review-button')).toBeTruthy();
  });

  it('fires review_submit with productId + rating, no PII, on mutation success', () => {
    // Simulate immediate onSuccess when mutate is called
    vi.mocked(useMutation).mockImplementation((opts: { onSuccess?: (data: unknown) => void }) => ({
      mutate: vi.fn(() => { opts.onSuccess?.({ id: 'review-1' }); }),
      isPending: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const { getByTestId } = render(<ReviewSubmitForm productId="prod-42" />);

    // Select 4 stars (TouchableOpacity maps onPress → onClick in test mock)
    fireEvent.click(getByTestId('star-4'));
    // Submit
    fireEvent.click(getByTestId('submit-review-button'));

    expect(mockCaptureEvent).toHaveBeenCalledOnce();
    const [eventName, props] = mockCaptureEvent.mock.calls[0]!;
    expect(eventName).toBe('review_submit');
    expect(props?.productId).toBe('prod-42');
    expect(props?.rating).toBe(4);

    // PII guard
    const PII_KEYS = ['phone', 'phoneE164', 'name', 'customerName', 'otp', 'pan', 'address'];
    for (const key of PII_KEYS) {
      expect(Object.keys(props ?? {})).not.toContain(key);
    }
  });
});
