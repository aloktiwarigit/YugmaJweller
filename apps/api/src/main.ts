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
  const port = Number(process.env['PORT'] ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'api listening');

  const signals = ['SIGTERM', 'SIGINT'] as const;
  for (const sig of signals) {
    process.once(sig, () => void shutdownPosthog());
  }
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
