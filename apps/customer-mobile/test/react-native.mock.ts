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

const FlatListMock = React.forwardRef<unknown, AnyProps>(
  ({ testID, data, renderItem, keyExtractor, ListFooterComponent, ...rest }, ref) => {
    const extraProps: AnyProps = {};
    if (testID !== undefined) extraProps['data-testid'] = testID;
    const items = Array.isArray(data) ? data : [];
    const children: React.ReactNode[] = items.map((item, index) => {
      const key = typeof keyExtractor === 'function'
        ? (keyExtractor as (value: unknown, i: number) => React.Key)(item, index)
        : String(index);
      return React.createElement(
        React.Fragment,
        { key },
        typeof renderItem === 'function'
          ? (renderItem as (info: { item: unknown; index: number }) => React.ReactNode)({ item, index })
          : null,
      );
    });
    if (ListFooterComponent) {
      children.push(
        React.createElement(
          React.Fragment,
          { key: 'footer' },
          typeof ListFooterComponent === 'function'
            ? React.createElement(ListFooterComponent as React.ComponentType)
            : ListFooterComponent as React.ReactNode,
        ),
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why
    return React.createElement('flat-list', { ...(rest as any), ...extraProps, ref }, children);
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

// Default to 'ios' so first-party code that branches on Platform.OS (e.g.
// secure-storage's web/native gate) exercises the native path under unit
// test. Tests that need the web path can mutate Platform.OS in beforeEach.
export const Platform: { OS: 'ios' | 'android' | 'web'; select: <T>(opts: { ios?: T; android?: T; web?: T; default?: T }) => T | undefined } = {
  OS: 'ios',
  select: <T>(opts: { ios?: T; android?: T; web?: T; default?: T }): T | undefined =>
    opts.ios ?? opts.default,
};

export const View = passthrough('view');
export const Text = passthrough('text');
export const Pressable = PressableMock;
export const TouchableOpacity = PressableMock;
export const FlatList = FlatListMock;
export const TextInput = TextInputMock;
export const Modal = ModalMock;
export const ScrollView = passthrough('scroll-view');
export const ActivityIndicator = passthrough('activity-indicator');
export const Image = ImageMock;
export const StyleSheet = {
  create: <T>(s: T): T => s,
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flatten: (s: unknown): Record<string, unknown> =>
    Array.isArray(s)
      ? (Object.assign({}, ...s) as Record<string, unknown>)
      : ((s ?? {}) as Record<string, unknown>),
};

const noopAnimation = { start: (_cb?: () => void) => {}, stop: () => {}, reset: () => {} };
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
  loop: (_animation: unknown) => noopAnimation,
};
