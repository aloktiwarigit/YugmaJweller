import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { logger } from '@goldsmith/observability';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      // If the response body has a `code` field (from our ForbiddenException({ code: '...' })), hoist it to top level.
      if (typeof body === 'object' && body !== null && 'code' in body) {
        logger.error({ err: exception, status }, 'request failed');
        res.status(status).json(body);
        return;
      }
    }
    const code = exception instanceof Error ? exception.message : 'internal_error';
    logger.error({ err: exception, status }, 'request failed');
    res.status(status).json({ error: { code, status } });
  }
}
