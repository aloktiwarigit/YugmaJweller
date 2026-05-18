// apps/customer-web/test/filter-panel.test.tsx
//
// Story 19.10 — FilterPanel unit tests.
// Covers: gift persona section, label names, URL param generation,
// active-chip display, clear-all, and ARIA pressed state.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const pushSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import {
  FilterSidebar,
  FilterControls,
  GIFT_PERSONA_LABELS_HI,
  type ActiveFilters,
} from '../components/FilterPanel';

const EMPTY: ActiveFilters = {};

beforeEach(() => { vi.clearAllMocks(); });

// ─── FilterSidebar section labels ─────────────────────────────────────────────

describe('FilterSidebar section labels', () => {
  it('shows "दाम" (not "मूल्य") as price section heading', () => {
    render(<FilterSidebar filters={EMPTY} />);
    expect(screen.getByText('दाम')).toBeTruthy();
    expect(screen.queryByText('मूल्य')).toBeNull();
  });

  it('shows "मौजूद" (not "उपलब्धता") as in-stock section heading', () => {
    render(<FilterSidebar filters={EMPTY} />);
    expect(screen.getByText('मौजूद')).toBeTruthy();
    expect(screen.queryByText('उपलब्धता')).toBeNull();
  });

  it('shows "उपहार किसके लिए" as gift persona section heading', () => {
    render(<FilterSidebar filters={EMPTY} />);
    expect(screen.getByText('उपहार किसके लिए')).toBeTruthy();
  });
});

// ─── Gift persona chips render ────────────────────────────────────────────────

describe('gift persona chips', () => {
  beforeEach(() => {
    render(<FilterSidebar filters={EMPTY} />);
    // Open the gift persona section
    fireEvent.click(screen.getByText('उपहार किसके लिए'));
  });

  it('renders all 6 gift persona options', () => {
    expect(screen.getByLabelText('माँ')).toBeTruthy();
    expect(screen.getByLabelText('बहन')).toBeTruthy();
    expect(screen.getByLabelText('पत्नी')).toBeTruthy();
    expect(screen.getByLabelText('दुल्हन')).toBeTruthy();
    expect(screen.getByLabelText('खुद के लिए')).toBeTruthy();
    expect(screen.getByLabelText('दोस्त')).toBeTruthy();
  });

  it('clicking MOTHER chip calls router.push with ?giftPersona=MOTHER', () => {
    fireEvent.click(screen.getByLabelText('माँ'));
    expect(pushSpy).toHaveBeenCalledOnce();
    const url: string = pushSpy.mock.calls[0][0];
    expect(url).toContain('giftPersona=MOTHER');
  });

  it('clicking WIFE chip calls router.push with ?giftPersona=WIFE', () => {
    fireEvent.click(screen.getByLabelText('पत्नी'));
    const url: string = pushSpy.mock.calls[0][0];
    expect(url).toContain('giftPersona=WIFE');
  });
});

// ─── Gift persona ARIA pressed state ─────────────────────────────────────────

describe('gift persona ARIA active state', () => {
  it('SISTER chip is checked when filters.giftPersona === "SISTER"', () => {
    render(<FilterSidebar filters={{ giftPersona: 'SISTER' }} />);
    fireEvent.click(screen.getByText('उपहार किसके लिए'));
    const checkbox = screen.getByLabelText('बहन') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking SISTER removes giftPersona from URL', () => {
    render(<FilterSidebar filters={{ giftPersona: 'SISTER' }} />);
    fireEvent.click(screen.getByText('उपहार किसके लिए'));
    fireEvent.click(screen.getByLabelText('बहन'));
    const url: string = pushSpy.mock.calls[0][0];
    expect(url).not.toContain('giftPersona');
  });
});

// ─── Active filter chips ──────────────────────────────────────────────────────

describe('FilterControls active filter chips', () => {
  it('shows active chip label for giftPersona=MOTHER', () => {
    render(<FilterControls filters={{ giftPersona: 'MOTHER' }} totalCount={5} />);
    expect(screen.getByText('माँ')).toBeTruthy();
  });

  it('shows active chip label for giftPersona=SELF', () => {
    render(<FilterControls filters={{ giftPersona: 'SELF' }} totalCount={2} />);
    expect(screen.getByText('खुद के लिए')).toBeTruthy();
  });

  it('clicking the active giftPersona chip removes it from URL', () => {
    render(<FilterControls filters={{ giftPersona: 'WIFE' }} totalCount={3} />);
    fireEvent.click(screen.getByLabelText('पत्नी फ़िल्टर हटाएं'));
    const url: string = pushSpy.mock.calls[0][0];
    expect(url).not.toContain('giftPersona');
  });

  it('shows inStockOnly as "उपलब्ध" active chip', () => {
    render(<FilterControls filters={{ inStockOnly: true }} totalCount={10} />);
    expect(screen.getByText('उपलब्ध')).toBeTruthy();
  });
});

// ─── Clear all ────────────────────────────────────────────────────────────────

describe('clear all with giftPersona active', () => {
  it('removes giftPersona and all filters from URL, preserves search', () => {
    render(<FilterControls
      filters={{ giftPersona: 'FRIEND', metal: 'GOLD', search: 'हार' }}
      totalCount={7}
    />);
    fireEvent.click(screen.getByText('सभी हटाएं'));
    const url: string = pushSpy.mock.calls[0][0];
    expect(url).not.toContain('giftPersona');
    expect(url).not.toContain('metal');
    expect(url).toContain('search=');
  });
});

// ─── Filter count includes giftPersona ───────────────────────────────────────

describe('mobile filter button count', () => {
  it('includes giftPersona in active filter count', () => {
    render(<FilterControls
      filters={{ giftPersona: 'BRIDE', metal: 'GOLD' }}
      totalCount={4}
    />);
    // Mobile button shows "फ़िल्टर (2)" — 2 active filters
    expect(screen.getByText('फ़िल्टर (2)')).toBeTruthy();
  });

  it('shows count of 1 when only giftPersona is active', () => {
    render(<FilterControls filters={{ giftPersona: 'MOTHER' }} totalCount={8} />);
    expect(screen.getByText('फ़िल्टर (1)')).toBeTruthy();
  });
});

// ─── GIFT_PERSONA_LABELS_HI export ───────────────────────────────────────────

describe('GIFT_PERSONA_LABELS_HI export', () => {
  it('maps all 6 CATALOG_GIFT_PERSONAS values', () => {
    const keys = ['MOTHER', 'SISTER', 'WIFE', 'BRIDE', 'SELF', 'FRIEND'];
    for (const k of keys) {
      expect(GIFT_PERSONA_LABELS_HI[k]).toBeTruthy();
    }
  });
});
