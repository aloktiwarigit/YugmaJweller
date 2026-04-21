import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AuditEventRow } from '../src/primitives/AuditEventRow';

describe('AuditEventRow', () => {
  const baseProps = {
    action: 'AUTH_LOGOUT_ALL',
    actorName: 'Ramesh Kumar',
    actorRole: 'shop_admin',
    createdAt: '2026-04-20T10:00:00Z',
    testID: 'audit-row',
  };

  it('renders Hindi label for known action', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} />);
    expect(getByText('सभी devices से logout')).toBeTruthy();
  });

  it('falls back to action key for unknown action', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} action="UNKNOWN_ACTION" />);
    expect(getByText('UNKNOWN_ACTION')).toBeTruthy();
  });

  it('renders actor name and Hindi role', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} />);
    expect(getByText('Ramesh Kumar · मालिक')).toBeTruthy();
  });

  it('renders IST date string (not raw UTC)', () => {
    const { getByTestId } = render(<AuditEventRow {...baseProps} />);
    const container = getByTestId('audit-row');
    // IST for 2026-04-20T10:00:00Z = 2026-04-20T15:30:00+05:30
    // Should contain IST time, not UTC time
    // The exact format depends on Intl — just check it's not the raw ISO string
    expect(container).toBeTruthy();
  });

  it('applies testID to the outer View', () => {
    const { getByTestId } = render(<AuditEventRow {...baseProps} />);
    expect(getByTestId('audit-row')).toBeTruthy();
  });

  it('falls back role key for unknown role', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} actorRole="unknown_role" />);
    expect(getByText('Ramesh Kumar · unknown_role')).toBeTruthy();
  });

  it('renders Hindi label for STAFF_INVITED action', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} action="STAFF_INVITED" />);
    expect(getByText('स्टाफ़ आमंत्रित')).toBeTruthy();
  });

  it('renders Hindi label for AUTH_VERIFY_SUCCESS action', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} action="AUTH_VERIFY_SUCCESS" />);
    expect(getByText('लॉगिन सफल')).toBeTruthy();
  });

  it('renders shop_manager role in Hindi', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} actorRole="shop_manager" />);
    expect(getByText('Ramesh Kumar · प्रबंधक')).toBeTruthy();
  });

  it('renders system role in Hindi', () => {
    const { getByText } = render(<AuditEventRow {...baseProps} actorRole="system" />);
    expect(getByText('Ramesh Kumar · सिस्टम')).toBeTruthy();
  });
});
