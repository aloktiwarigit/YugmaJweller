import React from 'react';

// Minimal React Native mock for vitest/jsdom testing.
// Passes through all props (including style, testID, accessibilityRole) so
// declarative style assertions work without native rendering.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim; `any` intentional here @why passthrough mock needs unconstrained props
type AnyProps = Record<string, unknown>;

const passthrough = (tag: string) =>
  React.forwardRef<unknown, AnyProps>((props, ref) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock shim @why createElement requires any-typed extra args
    React.createElement(tag, { ...(props as any), ref }),
  );

export const View = passthrough('view');
export const Text = passthrough('text');
export const Pressable = passthrough('pressable');
export const TextInput = passthrough('textinput');
export const StyleSheet = {
  create: <T>(s: T): T => s,
  flatten: (s: unknown): Record<string, unknown> =>
    Array.isArray(s)
      ? (Object.assign({}, ...s) as Record<string, unknown>)
      : ((s ?? {}) as Record<string, unknown>),
};
