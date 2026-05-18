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

  // CORS allowlist — for browser clients that hit the API directly:
  //   - platform admin UI in customer-web /admin
  //   - customer-web /profile/delete-account (Story 19.7: browser-side
  //     Firebase OTP gate → DELETE /api/v1/crm/customer/me with
  //     X-Tenant-Id header).
  // Set ADMIN_WEB_ORIGIN and CUSTOMER_WEB_ORIGIN to comma-separated lists
  // in production (e.g. "https://admin.goldsmith.example").
  const defaultBrowserOrigins = process.env['NODE_ENV'] === 'production'
    ? ''   // fail-closed in production: no CORS if env var is missing
    : 'http://localhost:3000,http://localhost:4173,http://127.0.0.1:4173';
  const adminOriginsRaw    = process.env['ADMIN_WEB_ORIGIN']    ?? defaultBrowserOrigins;
  const customerOriginsRaw = process.env['CUSTOMER_WEB_ORIGIN'] ?? defaultBrowserOrigins;
  if (process.env['NODE_ENV'] === 'production' && !adminOriginsRaw) {
    throw new Error('ADMIN_WEB_ORIGIN must be set in production');
  }
  const allowedOrigins = [
    ...adminOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    ...customerOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE'],
    // X-Tenant-Id added in Story 19.7 — customer-web's DELETE
    // /api/v1/crm/customer/me sends it from the browser.
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Impersonation-Token', 'X-Tenant-Id'],
    credentials: false,
    maxAge: 600,
  });

  const port = Number(process.env['PORT'] ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port, allowedOrigins }, 'api listening');

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
