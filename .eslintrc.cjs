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
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
    // Test/spec files: relax return-type and shopId-param rules — factory functions
    // and helpers in tests don't benefit from strict return-type annotations.
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        'goldsmith/no-raw-shop-id-param': 'off',
      },
    },
    // Auth module repos + services use raw shopId internally (equivalent to packages/db layer).
    {
      files: [
        'apps/api/src/modules/auth/auth.repository.ts',
        'apps/api/src/modules/auth/auth.service.ts',
        'apps/api/src/modules/auth/permissions.repository.ts',
        // Inventory repository is a data-layer method (shopId from tenant context at call-site).
        'apps/api/src/modules/inventory/inventory.repository.ts',
        // Catalog controller reads tenantId from X-Tenant-Id header on a @SkipTenant() endpoint.
        'apps/api/src/modules/catalog/catalog.controller.ts',
      ],
      rules: { 'goldsmith/no-raw-shop-id-param': 'off' },
    },
    // NestJS framework wiring files need @nestjs/bullmq for DI module registration.
    // bullmq restriction lifted; ioredis still restricted.
    {
      files: [
        'apps/api/src/app.module.ts',
        '**/apps/api/src/app.module.ts',
        'apps/api/src/workers/**/*.ts',
        '**/apps/api/src/workers/**/*.ts',
        'apps/api/src/modules/pricing/pricing.module.ts',
        '**/apps/api/src/modules/pricing/pricing.module.ts',
        'apps/api/src/modules/inventory/inventory.module.ts',
        '**/apps/api/src/modules/inventory/inventory.module.ts',
      ],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
          ],
        }],
      },
    },
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
