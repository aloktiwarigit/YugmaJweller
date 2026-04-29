import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { DeletionRequestSheet } from './DeletionRequestSheet';

const baseProps = {
  visible:      true,
  customerId:   'eeeeeeee-ffff-4000-8000-000000000003',
  customerName: 'रमेश गुप्ता',
  onClose:      vi.fn(),
  onConfirmed:  vi.fn(),
  onRequestDelete: vi.fn(async () => ({
    scheduledAt:  '2026-04-26T12:00:00Z',
    hardDeleteAt: '2026-05-26T12:00:00Z',
  })),
};

beforeEach(() => { vi.clearAllMocks(); });

describe('DeletionRequestSheet', () => {
  it('confirm button is no-op until typed name matches exactly', () => {
    const onRequestDelete = vi.fn();
    const { getByTestId } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} />,
    );

    fireEvent.click(getByTestId('deletion-confirm-btn'));
    expect(onRequestDelete).not.toHaveBeenCalled();

    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: 'रमेश' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));
    expect(onRequestDelete).not.toHaveBeenCalled();

    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: 'रमेश गुप्ता' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));
    expect(onRequestDelete).toHaveBeenCalledOnce();
  });

  it('trims whitespace before comparing names', () => {
    const onRequestDelete = vi.fn(async () => ({
      scheduledAt:  '2026-04-26T12:00:00Z',
      hardDeleteAt: '2026-05-26T12:00:00Z',
    }));
    const { getByTestId } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} />,
    );
    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: '  रमेश गुप्ता  ' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));
    expect(onRequestDelete).toHaveBeenCalledOnce();
  });

  it('calls onRequestDelete with customerId and confirmation, then onConfirmed', async () => {
    const onRequestDelete = vi.fn(async () => ({
      scheduledAt:  '2026-04-26T12:00:00Z',
      hardDeleteAt: '2026-05-26T12:00:00Z',
    }));
    const onConfirmed = vi.fn();
    const { getByTestId } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} onConfirmed={onConfirmed} />,
    );
    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: 'रमेश गुप्ता' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));

    await waitFor(() => expect(onRequestDelete).toHaveBeenCalledOnce());
    expect(onRequestDelete).toHaveBeenCalledWith(baseProps.customerId, 'रमेश गुप्ता', 'owner');
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });

  it('shows Hindi error for crm.deletion.open_invoices', async () => {
    const onRequestDelete = vi.fn(async () => {
      throw { response: { code: 'crm.deletion.open_invoices' } };
    });
    const { getByTestId, findByText } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} />,
    );
    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: 'रमेश गुप्ता' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));
    await findByText(/लंबित Draft invoice/);
  });

  it('shows Hindi error for crm.deletion.already_requested', async () => {
    const onRequestDelete = vi.fn(async () => {
      throw { response: { code: 'crm.deletion.already_requested' } };
    });
    const { getByTestId, findByText } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} />,
    );
    fireEvent.change(getByTestId('deletion-confirmation-input'), { target: { value: 'रमेश गुप्ता' } });
    fireEvent.click(getByTestId('deletion-confirm-btn'));
    await findByText(/पहले से दर्ज है/);
  });

  it('cancel does not invoke onRequestDelete', () => {
    const onRequestDelete = vi.fn();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <DeletionRequestSheet {...baseProps} onRequestDelete={onRequestDelete} onClose={onClose} />,
    );
    fireEvent.click(getByTestId('deletion-cancel-btn'));
    expect(onRequestDelete).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
