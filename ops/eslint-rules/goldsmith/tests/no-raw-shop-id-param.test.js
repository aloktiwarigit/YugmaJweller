const { RuleTester } = require('eslint');
const rule = require('../rules/no-raw-shop-id-param');

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

tester.run('no-raw-shop-id-param', rule, {
  valid: [
    { code: 'async function create(ctx: TenantContext, input: Dto) {}' },
    { code: 'class X { async do(ctx: TenantContext, arg: number) {} }' },
    { code: 'function migrateShop(shopId: string) {}', filename: 'packages/db/src/migrate.ts' },
  ],
  invalid: [
    {
      code: 'class X { async create(shopId: string, input: Dto) {} }',
      filename: 'apps/api/src/modules/demo/demo.service.ts',
      errors: [{ messageId: 'noRawShopIdParam' }],
    },
    {
      code: 'async function doThing(shopId: string) {}',
      filename: 'apps/api/src/modules/demo/demo.service.ts',
      errors: [{ messageId: 'noRawShopIdParam' }],
    },
  ],
});

console.log('no-raw-shop-id-param rule tests passed');
