import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Text } from 'react-native';
import { SettingsGroupCard } from '../src/primitives/SettingsGroupCard';

describe('SettingsGroupCard', () => {
  it('renders the title text', () => {
    const { getByText } = render(
      <SettingsGroupCard title="खाता सेटिंग">
        <Text>child</Text>
      </SettingsGroupCard>,
    );
    expect(getByText('खाता सेटिंग')).toBeTruthy();
  });

  it('renders children', () => {
    const { getByText } = render(
      <SettingsGroupCard title="Section">
        <Text>child content</Text>
      </SettingsGroupCard>,
    );
    expect(getByText('child content')).toBeTruthy();
  });

  it('applies testID to the outer View', () => {
    const { getByTestId } = render(
      <SettingsGroupCard title="Section" testID="settings-card">
        <Text>child</Text>
      </SettingsGroupCard>,
    );
    expect(getByTestId('settings-card')).toBeTruthy();
  });

  it('accepts custom style prop without crashing', () => {
    const { getByTestId } = render(
      <SettingsGroupCard title="Section" testID="settings-card" style={{ marginHorizontal: 8 }}>
        <Text>child</Text>
      </SettingsGroupCard>,
    );
    expect(getByTestId('settings-card')).toBeTruthy();
  });
});
