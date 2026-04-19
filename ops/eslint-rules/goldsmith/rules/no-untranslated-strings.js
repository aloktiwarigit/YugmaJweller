'use strict';
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid bare string literals inside <Text>, <Button title>, <Input placeholder>, <Input label>.' },
    messages: { noUntranslatedString: 'Bare string in UI primitive — wrap in t() (spec §13 invariant 21).' },
    schema: [],
  },
  create(ctx) {
    const TARGETS = new Set(['Text', 'Button', 'Input']);
    const ATTR_KEYS = new Set(['title', 'placeholder', 'label']);
    const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
    return {
      JSXElement(node) {
        const name = node.openingElement.name;
        if (name.type !== 'JSXIdentifier' || !TARGETS.has(name.name)) return;
        // children
        for (const child of node.children) {
          if (child.type === 'JSXText' && isNonEmpty(child.value)) {
            ctx.report({ node: child, messageId: 'noUntranslatedString' });
          }
        }
        // attributes
        for (const attr of node.openingElement.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (attr.name.type !== 'JSXIdentifier' || !ATTR_KEYS.has(attr.name.name)) continue;
          const v = attr.value;
          if (v && v.type === 'Literal' && isNonEmpty(v.value)) {
            ctx.report({ node: attr, messageId: 'noUntranslatedString' });
          }
        }
      },
    };
  },
};
