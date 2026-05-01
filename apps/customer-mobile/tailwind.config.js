/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Direction 05 — Hindi-First Editorial palette (mirrors @goldsmith/ui-tokens)
        bg: '#F5EDDD',
        ink: '#1E2440',
        'ink-mute': '#4A526E',
        border: '#D9C9A8',
        white: '#FFFFFF',
        primary: '#B58A3C',
        accent: '#D4745A',
        error: '#B1402B',
      },
      fontFamily: {
        display: ['YatraOne'],
        body: ['MuktaVaani-400'],
        'body-medium': ['MuktaVaani-500'],
        'body-semibold': ['MuktaVaani-600'],
        'body-bold': ['MuktaVaani-700'],
        serif: ['TiroDevanagariHindi-Regular'],
        'serif-italic': ['TiroDevanagariHindi-Italic'],
        latin: ['Fraunces-Italic'],
      },
    },
  },
  plugins: [],
};
