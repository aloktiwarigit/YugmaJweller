/* eslint-env node */
module.exports = {
  extends: ['../../.eslintrc.cjs'],
  // android/ is gitignored native build output — not source; exclude from lint.
  ignorePatterns: ['android/', 'ios/'],
  // expo-haptics is a native Expo module: not installed in node_modules but
  // available at runtime via Expo's native module registry. It is mocked in
  // vitest via vitest.config.ts alias and declared in expo-env.d.ts for tsc.
  // Tell the import resolver to skip it rather than false-positive on "unresolved".
  settings: {
    'import/ignore': ['expo-haptics'],
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Node CommonJS config files — let them use CJS globals.
      files: ['*.js', 'metro.config.js', 'babel.config.js', 'plugins/**/*.js'],
      env: { node: true, commonjs: true },
      parserOptions: { sourceType: 'script' },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    },
    {
      // Test mocks — pragmatic passthrough shims; no return-type obligation.
      files: ['test/**/*.ts', 'test/**/*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        'import/no-named-as-default-member': 'off',
      },
    },
    {
      // Provider files that default-import expo-constants — the package has odd
      // export shape; default import is canonical per their docs.
      files: ['src/providers/**/*.tsx', 'src/api/**/*.ts'],
      rules: {
        'import/no-named-as-default': 'off',
      },
    },
  ],
};
