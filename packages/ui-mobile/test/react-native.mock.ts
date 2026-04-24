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
export const ScrollView = passthrough('scrollview');
export const ActivityIndicator = passthrough('activityindicator');
export const StyleSheet = {
  create: <T>(s: T): T => s,
  flatten: (s: unknown): Record<string, unknown> =>
    Array.isArray(s)
      ? (Object.assign({}, ...s) as Record<string, unknown>)
      : ((s ?? {}) as Record<string, unknown>),
  // Match the iOS/Android value so components using StyleSheet.hairlineWidth compile/run in tests
  hairlineWidth: 0.5,
};

// Animated — lightweight stub sufficient for jsdom unit tests.
// AnimatedValue tracks _value and supports interpolate() for backgroundColor animations.
class AnimatedValue {
  _value: number;
  constructor(v: number) { this._value = v; }
  setValue(v: number) { this._value = v; }
  interpolate(_cfg: unknown) { return this._value; }
  stopAnimation(_cb?: () => void) {}
  addListener(_cb: (_v: { value: number }) => void): string { return ''; }
  removeAllListeners() {}
}

const noopAnim = {
  start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
  stop: () => {},
  reset: () => {},
};

export const Animated = {
  Value: AnimatedValue,
  // Use 'animatedview' tag — tests query container.querySelector('animatedview')
  View: passthrough('animatedview'),
  timing: (_v: unknown, _cfg: unknown) => noopAnim,
  parallel: (_anims: unknown[]) => noopAnim,
  sequence: (_anims: unknown[]) => noopAnim,
  spring: (_v: unknown, _cfg: unknown) => noopAnim,
  loop: (_anim: typeof noopAnim) => noopAnim,
  delay: (_ms: number) => noopAnim,
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: (_event: string, _handler: () => void) => ({ remove: () => {} }),
  announceForAccessibility: (_msg: string) => undefined,
};
