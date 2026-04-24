import { Database } from '@nozbe/watermelondb';
import { Platform } from 'react-native';
import { schema } from './schema';
import { Product } from './models/Product';

function makeAdapter() {
  if (Platform.OS === 'web' || process.env['NODE_ENV'] === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
    return new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  return new SQLiteAdapter({ schema, jsi: true, migrationEvents: true });
}

export const database = new Database({
  adapter: makeAdapter(),
  modelClasses: [Product],
});
