import { describe, it, expect } from 'vitest';
import { findRawPgTableUsages } from './assert-all-tables-marked';

describe('findRawPgTableUsages', () => {
  it('flags pgTable call that is not inside the helpers directory', () => {
    const source = `
      import { pgTable, text } from 'drizzle-orm/pg-core';
      export const widgets = pgTable('widgets', { name: text('name') });
    `;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toMatch(/tenantScopedTable|platformGlobalTable/);
  });

  it('allows pgTable used inside the helpers directory', () => {
    const source = `import { pgTable } from 'drizzle-orm/pg-core'; pgTable('x', {});`;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/_helpers/tenantScopedTable.ts');
    expect(hits).toHaveLength(0);
  });

  it('ignores comments that mention pgTable', () => {
    const source = `// pgTable is only allowed in _helpers\nexport const x = 1;`;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
    expect(hits).toHaveLength(0);
  });
});
