import React from 'react';

type AnyProps = Record<string, unknown>;

const passthrough = (tag: string) =>
  React.forwardRef<unknown, AnyProps>(({ testID, ...rest }, ref) => {
    const extraProps = testID !== undefined ? { 'data-testid': testID } : {};
    return React.createElement(tag, { ...(rest as object), ...extraProps, ref });
  });

export default passthrough('svg'); // default export = Svg
export const Svg = passthrough('svg');
export const G = passthrough('g');
export const Path = passthrough('path');
export const Polyline = passthrough('polyline');
export const Line = passthrough('line');
export const Circle = passthrough('circle');
export const Text = passthrough('text');
export const Rect = passthrough('rect');
