import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../src/providers/ThemeProvider';

// Helper consumer component
function ThemeConsumer(): React.ReactElement {
  const theme = useTheme();
  return <Text testID="primary">{theme.primaryColor}</Text>;
}

describe('ThemeProvider', () => {
  it('provides default Direction 5 primary color when no theme prop', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(getByTestId('primary').props['children']).toBe('#B58A3C');
  });

  it('merges partial theme override correctly', () => {
    const { getByTestId } = render(
      <ThemeProvider theme={{ primaryColor: '#FF0000' }}>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(getByTestId('primary').props['children']).toBe('#FF0000');
  });

  it('preserves default secondaryColor when not overridden', () => {
    function SecondaryConsumer(): React.ReactElement {
      const theme = useTheme();
      return <Text testID="secondary">{theme.secondaryColor}</Text>;
    }
    const { getByTestId } = render(
      <ThemeProvider theme={{ primaryColor: '#FF0000' }}>
        <SecondaryConsumer />
      </ThemeProvider>,
    );
    // colors.accent from ui-tokens = '#D4745A'
    expect(getByTestId('secondary').props['children']).toBe('#D4745A');
  });
});
