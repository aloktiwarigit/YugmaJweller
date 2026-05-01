/* eslint-env node */
module.exports = {
  root: false,
  extends: ['../../.eslintrc.cjs'],
  ignorePatterns: ['dist/**', 'node_modules/**', '.expo/**'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Node CommonJS config files — let them use CJS globals.
      files: ['*.js', 'metro.config.js', 'babel.config.js', 'tailwind.config.js'],
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
      // Provider/api default-imports expo-constants — package has odd export shape.
      files: ['src/providers/**/*.tsx', 'src/api/**/*.ts'],
      rules: {
        'import/no-named-as-default': 'off',
      },
    },
  ],
};
