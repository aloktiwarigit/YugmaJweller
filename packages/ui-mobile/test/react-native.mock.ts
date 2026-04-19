import React from 'react';

// Minimal React Native mock for vitest/jsdom + @testing-library/react testing.
// - testID is mapped to data-testid so @testing-library/react getByTestId works.
// - style objects are passed through so React serialises them as inline CSS.
// - Other RN-specific props are passed through transparently.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim; `any` intentional here @why passthrough mock needs unconstrained props
type AnyProps = Record<string, unknown>;

const passthrough = (tag: string) =>
  React.forwardRef<unknown, AnyProps>(({ testID, ...rest }, ref) => {
    // Map testID → data-testid for @testing-library/react getByTestId compatibility
    const extraProps = testID !== undefined ? { 'data-testid': testID } : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why createElement requires any-typed extra args
    return React.createElement(tag, { ...(rest as any), ...extraProps, ref });
  });

// onPress → onClick mapping for Pressable so fireEvent.click works
const PressableMock = React.forwardRef<unknown, AnyProps>(
  ({ testID, onPress, disabled, ...rest }, ref) => {
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    // Wire onPress to onClick so fireEvent.click triggers it (when not disabled)
    if (typeof onPress === 'function' && !disabled) {
      extraProps['onClick'] = onPress;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('pressable', { ...(rest as any), disabled, ...extraProps, ref });
  },
);

// onChangeText → onChange mapping for TextInput
// Uses 'input' tag so @testing-library fireEvent.change works (value setter exists on input elements)
const TextInputMock = React.forwardRef<unknown, AnyProps>(
  ({ testID, onChangeText, ...rest }, ref) => {
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    if (typeof onChangeText === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
      extraProps['onChange'] = (e: any) => (onChangeText as (v: string) => void)(e.target.value);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('input', { ...(rest as any), ...extraProps, ref });
  },
);

export const View = passthrough('view');
export const Text = passthrough('text');
export const Pressable = PressableMock;
export const TextInput = TextInputMock;
export const StyleSheet = {
  create: <T>(s: T): T => s,
  flatten: (s: unknown): Record<string, unknown> =>
    Array.isArray(s)
      ? (Object.assign({}, ...s) as Record<string, unknown>)
      : ((s ?? {}) as Record<string, unknown>),
};
