import React from 'react';

// Minimal React Native mock for vitest/jsdom + @testing-library/react testing.
// Mirrors apps/shopkeeper/test/react-native.mock.ts; adds Image (used by TenantBrandHeader).
// - testID is mapped to data-testid so @testing-library/react getByTestId works.
// - style objects are passed through so React serialises them as inline CSS.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim; `any` intentional here @why passthrough mock needs unconstrained props
type AnyProps = Record<string, unknown>;

const passthrough = (tag: string) =>
  React.forwardRef<unknown, AnyProps>(({ testID, ...rest }, ref) => {
    const extraProps = testID !== undefined ? { 'data-testid': testID } : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why createElement requires any-typed extra args
    return React.createElement(tag, { ...(rest as any), ...extraProps, ref });
  });

const PressableMock = React.forwardRef<unknown, AnyProps>(
  ({ testID, onPress, disabled, ...rest }, ref) => {
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    if (typeof onPress === 'function' && !disabled) {
      extraProps['onClick'] = onPress;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('pressable', { ...(rest as any), disabled, ...extraProps, ref });
  },
);

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

const ModalMock = React.forwardRef<unknown, AnyProps>(
  ({ visible, children, testID, ...rest }, ref) => {
    if (visible === false) return null;
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('modal', { ...(rest as any), ...extraProps, ref }, children as React.ReactNode);
  },
);

// Image renders as <img> with src from source.uri so accessibilityLabel maps to alt.
const ImageMock = React.forwardRef<unknown, AnyProps>(
  ({ testID, source, accessibilityLabel, ...rest }, ref) => {
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    if (accessibilityLabel !== undefined) extraProps['alt'] = accessibilityLabel;
    const src = (source as { uri?: string } | undefined)?.uri;
    if (src !== undefined) extraProps['src'] = src;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('img', { ...(rest as any), ...extraProps, ref });
  },
);

export const View = passthrough('view');
export const Text = passthrough('text');
export const Pressable = PressableMock;
export const TextInput = TextInputMock;
export const Modal = ModalMock;
export const ScrollView = passthrough('scroll-view');
export const ActivityIndicator = passthrough('activity-indicator');
export const Image = ImageMock;
export const StyleSheet = {
  create: <T>(s: T): T => s,
  flatten: (s: unknown): Record<string, unknown> =>
    Array.isArray(s)
      ? (Object.assign({}, ...s) as Record<string, unknown>)
      : ((s ?? {}) as Record<string, unknown>),
};

const noopAnimation = { start: (_cb?: () => void) => {} };
export const Animated = {
  Value: class {
    constructor(_v: number) {}
    stopAnimation(_cb?: () => void) {}
    setValue(_v: number) {}
  },
  View: passthrough('animated-view'),
  timing: (_val: unknown, _config: unknown) => noopAnimation,
  sequence: (_animations: unknown[]) => noopAnimation,
  parallel: (_animations: unknown[]) => noopAnimation,
  spring: (_val: unknown, _config: unknown) => noopAnimation,
  delay: (_ms: number) => noopAnimation,
};
