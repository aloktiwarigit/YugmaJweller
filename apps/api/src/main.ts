import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { initSentry, initOtel, logger } from '@goldsmith/observability';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  initSentry();
  initOtel('goldsmith-api');
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  const port = Number(process.env['PORT'] ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'api listening');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
