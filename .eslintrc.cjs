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
        // packages/sync server functions take shopId as an explicit param — they ARE the data layer
        // (cursor/push/sync-logger work inside withTenantTx, shopId passed from ctx at call-site).
        'packages/sync/src/server/cursor.ts',
        'packages/sync/src/server/push.ts',
        'packages/sync/src/server/sync-logger.ts',
        // Meilisearch adapter is infrastructure: per-tenant index naming uses shopId directly.
        'packages/integrations/search/src/adapters/meilisearch.adapter.ts',
        // Search service: indexProduct/removeFromIndex are called from BullMQ worker (no TenantContext).
        // postgresSearch is a private helper receiving shopId extracted from ctx at the call site.
        'apps/api/src/modules/inventory/inventory.search.service.ts',
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
        'apps/api/src/modules/billing/billing.module.ts',
        '**/apps/api/src/modules/billing/billing.module.ts',
        'apps/api/src/modules/billing/payment.service.ts',
        '**/apps/api/src/modules/billing/payment.service.ts',
        'apps/api/src/modules/webhooks/razorpay.controller.ts',
        '**/apps/api/src/modules/webhooks/razorpay.controller.ts',
        'apps/api/src/modules/webhooks/webhooks.module.ts',
        '**/apps/api/src/modules/webhooks/webhooks.module.ts',
        'apps/api/src/modules/crm/crm.module.ts',
        '**/apps/api/src/modules/crm/crm.module.ts',
        'apps/api/src/workers/compliance-pmla.processor.ts',
        '**/apps/api/src/workers/compliance-pmla.processor.ts',
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
