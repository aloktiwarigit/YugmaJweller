/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'goldsmith'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    'goldsmith/no-raw-shop-id-param': 'error',
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
      ],
    }],
  },
  settings: { 'import/resolver': { typescript: true } },
  ignorePatterns: ['dist', 'node_modules', '*.js.map'],
  overrides: [
    {
      files: ['packages/tenant-context/**/*.ts', '**/packages/tenant-context/**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { patterns: [
        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
      ] }] },
    },
    {
      files: ['packages/cache/**/*.ts', '**/packages/cache/**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { patterns: [
        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
      ] }] },
    },
    {
      files: ['packages/queue/**/*.ts', '**/packages/queue/**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { patterns: [
        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
      ] }] },
    },
    {
      files: ['packages/crypto-envelope/**/*.ts', '**/packages/crypto-envelope/**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { patterns: [
        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
      ] }] },
    },
  ],
};
