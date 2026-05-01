import type { Config } from 'tailwindcss';
import { colors } from '@goldsmith/ui-tokens';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:  'var(--primary-color, #B58A3C)',
        bg:       colors.bg,
        ink:      colors.ink,
        inkMute:  colors.inkMute,
        border:   colors.border,
        error:    colors.error,
        white:    colors.white,
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
