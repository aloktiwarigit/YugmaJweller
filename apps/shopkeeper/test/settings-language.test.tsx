import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../app/settings/index';
import { useLocaleStore } from '../src/stores/localeStore';

describe('settings language switch', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setLocale('hi-IN');
    useLocaleStore.setState({
      locale: 'hi-IN',
      source: 'default',
      hydrated: false,
    });
  });

  it('switches visible settings labels to English and persists the choice', async () => {
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.click(getByTestId('settings-language-en-IN'));

    await waitFor(() => {
      expect(getByText('My Account')).toBeTruthy();
    });
    expect(getByText('App language')).toBeTruthy();
    expect(await AsyncStorage.getItem('shopkeeper.locale')).toBe('en-IN');
    expect(useLocaleStore.getState().locale).toBe('en-IN');
  });
});
