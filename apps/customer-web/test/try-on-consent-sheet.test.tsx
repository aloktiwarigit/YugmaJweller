import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConsentSheet } from '../components/try-on/ConsentSheet';

describe('ConsentSheet', () => {
  it('renders consent copy in Hindi', () => {
    render(<ConsentSheet onAgree={vi.fn()} onCancel={vi.fn()} />);
    // Heading is present
    expect(screen.getByText('ट्राय करके देखें')).toBeInTheDocument();
    // Assurance list includes "डिवाइस पर"
    expect(screen.getByText(/डिवाइस पर/i)).toBeInTheDocument();
  });

  it('calls onAgree when agree button is clicked', () => {
    const onAgree = vi.fn();
    render(<ConsentSheet onAgree={onAgree} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /सहमत/i }));
    expect(onAgree).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConsentSheet onAgree={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /रद्द/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has role=dialog and aria-modal', () => {
    render(<ConsentSheet onAgree={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
