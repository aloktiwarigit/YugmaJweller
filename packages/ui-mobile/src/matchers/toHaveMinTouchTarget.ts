// Checks declared style for minHeight + minWidth ≥ 48.
// Limitation: does not measure actual rendered bounding box — intended for declarative style assertions only.
// Supports both React element-style objects (props.style) and DOM HTMLElement.style (CSSStyleDeclaration).
export function toHaveMinTouchTarget(received: unknown): {
  pass: boolean;
  message: () => string;
} {
  let mh: number | undefined;
  let mw: number | undefined;

  // DOM HTMLElement path (from @testing-library/react getByTestId)
  if (received instanceof HTMLElement) {
    const minHeight = received.style.minHeight;
    const minWidth = received.style.minWidth;
    mh = minHeight ? parseFloat(minHeight) : undefined;
    mw = minWidth ? parseFloat(minWidth) : undefined;
  } else {
    // React element / props.style path (fallback)
    const el = received as { props?: { style?: unknown } };
    const style = el?.props?.style;
    const flat: Record<string, unknown> = Array.isArray(style)
      ? (Object.assign({}, ...style) as Record<string, unknown>)
      : ((style ?? {}) as Record<string, unknown>);
    const rawH = flat['minHeight'];
    const rawW = flat['minWidth'];
    mh = typeof rawH === 'number' ? rawH : undefined;
    mw = typeof rawW === 'number' ? rawW : undefined;
  }

  const okH = mh !== undefined && mh >= 48;
  const okW = mw !== undefined && mw >= 48;
  return {
    pass: okH && okW,
    message: () =>
      `expected element to have minHeight ≥48 and minWidth ≥48; got minHeight=${String(mh)}, minWidth=${String(mw)}`,
  };
}
