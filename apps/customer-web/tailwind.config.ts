import type { Config } from 'tailwindcss';
import { colors, radii } from '@goldsmith/ui-tokens';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tenant-overridable via CSS var (set by buildThemeStyle)
        primary:         'var(--color-primary, #B58A3C)',
        primaryDeep:     colors.primaryDeep,
        primaryWash:     colors.primaryWash,
        accent:          'var(--color-accent, #D4745A)',
        accentWash:      colors.accentWash,
        bg:              colors.bg,
        surface:         colors.surface,
        surfaceElevated: colors.surfaceElevated,
        surfaceRecessed: colors.surfaceRecessed,
        ink:             colors.ink,
        inkMute:         colors.inkMute,
        inkSoft:         colors.inkSoft,
        border:          colors.border,
        borderSubtle:    colors.borderSubtle,
        borderStrong:    colors.borderStrong,
        error:           colors.error,
        successJade:     colors.successJade,
        successWash:     colors.successWash,
        warningSaffron:  colors.warningSaffron,
        warningWash:     colors.warningWash,
        infoSky:         colors.infoSky,
        white:           colors.white,
      },
      borderRadius: {
        xs:   `${radii.xs}px`,
        sm:   `${radii.sm}px`,
        md:   `${radii.md}px`,
        lg:   `${radii.lg}px`,
        pill: `${radii.pill}px`,
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        ui:      ['var(--font-ui)', 'system-ui', 'sans-serif'],
        prose:   ['var(--font-prose)', 'system-ui', 'sans-serif'],
        // legacy alias — keeps existing font-body usages working
        body:    ['var(--font-ui)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
