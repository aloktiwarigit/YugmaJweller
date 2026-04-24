/**
 * Story 4.4 — usePublicRates hook configuration tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@goldsmith/auth-client', () => ({
  getIdToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false }),
  };
});

import * as tq from '@tanstack/react-query';
import { usePublicRates } from '../src/hooks/usePublicRates';

describe('usePublicRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tq.useQuery).mockReturnValue(
      { data: undefined, isLoading: false } as ReturnType<typeof tq.useQuery>,
    );
  });

  it('configures refetchInterval as 60 000 ms', () => {
    usePublicRates();
    expect(vi.mocked(tq.useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ refetchInterval: 60_000 }),
    );
  });

  it('configures staleTime as 55 000 ms', () => {
    usePublicRates();
    expect(vi.mocked(tq.useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ staleTime: 55_000 }),
    );
  });

  it('uses queryKey ["catalog", "rates"]', () => {
    usePublicRates();
    expect(vi.mocked(tq.useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['catalog', 'rates'] }),
    );
  });
});
