/** @type {import('@lhci/utils/src/types').LhrConfig} */
module.exports = {
  ci: {
    collect: {
      // Static export mode: use 'serve' to host the out/ directory locally.
      // Run 'pnpm build' before 'pnpm test:lighthouse-ci'.
      // 'next start' is not valid for output: 'export'.
      staticDistDir: './out',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        // Note: product detail pages are now pre-rendered from API at build time.
        // Use /products/_placeholder which always renders a 404 (tests error handling).
      ],
      numberOfRuns: 1,
      settings: {
        // Mobile preset (primary target per CLAUDE.md audience profile)
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      // Phase E demo-readiness budgets.
      //   perf  → warn  at 0.8 (CI throttling is unpredictable; do not block PRs)
      //   a11y  → error at 0.9 (deterministic; fail fast on serious violations)
      assertions: {
        'categories:performance':   ['warn',  { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // Specific Core Web Vital signals
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':  ['warn', { maxNumericValue: 0.1 }],
        'server-response-time':     ['warn', { maxNumericValue: 500 }],
        'first-contentful-paint':   ['warn', { maxNumericValue: 1800 }],
        // No serious a11y violations
        'color-contrast': ['error', { minScore: 1 }],
        'image-alt':      ['error', { minScore: 1 }],
        'label':          ['error', { minScore: 1 }],
        'link-name':      ['error', { minScore: 1 }],
        // Skip flaky audits in CI (network-dependent)
        'uses-http2':         'off',
        'uses-long-cache-ttl': 'off',
      },
    },
    upload: {
      // Upload to temporary public storage for PR previews (no token required)
      target: 'temporary-public-storage',
    },
  },
};
