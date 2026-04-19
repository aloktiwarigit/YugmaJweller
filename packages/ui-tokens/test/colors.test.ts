import { describe, it, expect } from 'vitest';
import { colors } from '../src/colors';

describe('Direction 5 color tokens', () => {
  it('primary is aged-gold #B58A3C', () => { expect(colors.primary).toBe('#B58A3C'); });
  it('background cream is #F5EDDD', () => { expect(colors.bg).toBe('#F5EDDD'); });
  it('ink is indigo-ink #1E2440', () => { expect(colors.ink).toBe('#1E2440'); });
  it('accent (terracotta blush) is #D4745A', () => { expect(colors.accent).toBe('#D4745A'); });
});
