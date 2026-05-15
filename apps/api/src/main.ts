import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { initSentry, initOtel, initPosthog, shutdownPosthog, logger } from '@goldsmith/observability';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  initSentry();
  initOtel('goldsmith-api');
  initPosthog(process.env['POSTHOG_API_KEY'], process.env['POSTHOG_HOST']);
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  app.enableShutdownHooks();

  // CORS allowlist — only for browser clients that hit the API directly. The customer-web
  // public catalog uses Next.js SSR (server-to-server), so it doesn't need CORS. The
  // platform admin UI in customer-web /admin runs in the browser and DOES need it.
  // Tenant routes are server-rendered (mobile apps and SSR), so the allowlist is small.
  // Set ADMIN_WEB_ORIGIN to a comma-separated list in production (e.g. "https://admin.goldsmith.example").
  const adminOriginsRaw =
    process.env['ADMIN_WEB_ORIGIN'] ??
    'http://localhost:3000,http://localhost:4173,http://127.0.0.1:4173';
  const adminOrigins = adminOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: adminOrigins,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Impersonation-Token'],
    credentials: false,
    maxAge: 600,
  });

  const port = Number(process.env['PORT'] ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port, adminOrigins }, 'api listening');

  const signals = ['SIGTERM', 'SIGINT'] as const;
  for (const sig of signals) {
    process.once(sig, () => void shutdownPosthog());
  }
}

bootstrap().catch((err) => {
  // Write to stderr first (unbuffered on Linux) to guarantee capture in Cloud Logging
  // before process.exit(1) closes the stdout buffer.
  process.stderr.write('FATAL bootstrap failed: ' + (err?.message ?? '') + '\n' + (err?.stack ?? '') + '\n');
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
