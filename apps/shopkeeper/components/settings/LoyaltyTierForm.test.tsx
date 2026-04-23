import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LoyaltyTierForm } from './LoyaltyTierForm';

describe('LoyaltyTierForm', () => {
  const defaultProps = {
    tierIndex: 0 as const,
    initialName: 'Silver',
    initialThresholdRupees: '50000.00',
    initialBadgeColor: '#C0C0C0',
    onSave: vi.fn(),
    isSaving: false,
  };

  it('renders with initial values', () => {
    render(<LoyaltyTierForm {...defaultProps} />);
    const nameInput = screen.getByTestId('tier-0-name');
    const thresholdInput = screen.getByTestId('tier-0-threshold');
    const badgeColorInput = screen.getByTestId('tier-0-badge-color');
    expect((nameInput as HTMLInputElement).value).toBe('Silver');
    expect((thresholdInput as HTMLInputElement).value).toBe('50000.00');
    expect((badgeColorInput as HTMLInputElement).value).toBe('#C0C0C0');
  });

  it('calls onSave with correct values when form submitted with valid data', () => {
    const onSave = vi.fn();
    render(<LoyaltyTierForm {...defaultProps} onSave={onSave} />);

    // Change name
    fireEvent.change(screen.getByTestId('tier-0-name'), { target: { value: 'Bronze' } });
    fireEvent.change(screen.getByTestId('tier-0-threshold'), { target: { value: '10000.00' } });
    fireEvent.change(screen.getByTestId('tier-0-badge-color'), { target: { value: '#CD7F32' } });

    fireEvent.click(screen.getByTestId('tier-0-save'));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      name: 'Bronze',
      thresholdRupees: '10000.00',
      badgeColor: '#CD7F32',
    });
  });

  it('shows TIER_NAME_REQUIRED error when name is empty and form submitted', () => {
    render(<LoyaltyTierForm {...defaultProps} initialName="" />);
    fireEvent.click(screen.getByTestId('tier-0-save'));
    expect(screen.getByTestId('tier-0-name-error')).toBeDefined();
    expect(screen.getByTestId('tier-0-name-error').textContent).toContain('TIER_NAME_REQUIRED');
  });

  it('save button is disabled when isSaving=true', () => {
    const onSave = vi.fn();
    render(<LoyaltyTierForm {...defaultProps} isSaving={true} onSave={onSave} />);
    const saveButton = screen.getByTestId('tier-0-save');
    // Pressable mock omits onClick when disabled — clicking should not trigger onSave
    fireEvent.click(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });
});
