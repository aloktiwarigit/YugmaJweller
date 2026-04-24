'use strict';

const ALLOWED_PATH_FRAGMENTS = [
  '/packages/db/',
  'packages/db/',
  '/packages/tenant-context/',
  'packages/tenant-context/',
  '/packages/testing/',
  'packages/testing/',
  '/packages/crypto-envelope/',
  'packages/crypto-envelope/',
  '/packages/cache/',
  'packages/cache/',
  '/packages/tenant-config/',
  'packages/tenant-config/',
  '/scripts/',
  'scripts/',
  '/migrations/',
  'migrations/',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Service/repo methods must take `ctx: TenantContext` instead of a raw `shopId: string` param.',
    },
    messages: {
      noRawShopIdParam:
        'Forbidden: parameter `{{name}}: string` named `shopId`/`shop_id`/`tenantId`. Use `ctx: TenantContext` (ADR-0005).',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename || context.getFilename() || '').replace(/\\/g, '/');
    if (ALLOWED_PATH_FRAGMENTS.some((frag) => filename.includes(frag.replace(/\\/g, '/')))) {
      return {};
    }
    const check = (node) => {
      for (const p of node.params) {
        const id = p.type === 'Identifier' ? p : p.type === 'AssignmentPattern' ? p.left : null;
        if (!id || id.type !== 'Identifier') continue;
        const name = id.name;
        if (!/^(shopId|shop_id|tenantId)$/.test(name)) continue;
        const ann = id.typeAnnotation && id.typeAnnotation.typeAnnotation;
        const isString = ann && ann.type === 'TSStringKeyword';
        if (isString) context.report({ node: id, messageId: 'noRawShopIdParam', data: { name } });
      }
    };
    return {
      FunctionDeclaration: check,
      FunctionExpression(node) {
        // Skip: will be handled by MethodDefinition to avoid double-reporting
        if (node.parent && node.parent.type === 'MethodDefinition') return;
        check(node);
      },
      ArrowFunctionExpression: check,
      MethodDefinition(node) { check(node.value); },
      TSDeclareMethod(node) { check(node.value || node); },
    };
  },
};
