import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        // Inline (transform) these packages so the react-native alias below
        // is applied to their imports. Without this, CJS require() calls inside
        // node_modules bypass Vite's alias resolver.
        inline: ['@testing-library/react-native', 'react-test-renderer'],
      },
    },
  },
  resolve: {
    alias: {
      // Map react-native to our lightweight JSX-passthrough mock.
      // This alias is applied by Vite's transformer for both our source files
      // and any inlined node_modules (see server.deps.inline above).
      'react-native': path.join(__dirname, './test/react-native.mock.ts'),
      // Map react-native-svg to a passthrough mock — native SVG is unavailable in jsdom.
      'react-native-svg': path.join(__dirname, './test/react-native-svg.mock.ts'),
      // Resolve workspace packages to TypeScript source so tests don't need a dist build.
      '@goldsmith/money': path.join(__dirname, '../../packages/money/src/index.ts'),
      '@goldsmith/compliance': path.join(__dirname, '../../packages/compliance/src/index.ts'),
    },
  },
});
