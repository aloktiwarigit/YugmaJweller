import { randomUUID } from 'node:crypto';
import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { logger } from '@goldsmith/observability';

interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
  code?: string;
  [extra: string]: unknown;
}

const PG_CODE_MAP: Record<string, { status: number; title: string; code: string }> = {
  '23505': { status: HttpStatus.CONFLICT,               title: 'conflict',               code: 'conflict' },
  '23503': { status: HttpStatus.UNPROCESSABLE_ENTITY,   title: 'foreign_key_violation',  code: 'foreign_key_violation' },
  '23514': { status: HttpStatus.UNPROCESSABLE_ENTITY,   title: 'check_violation',        code: 'check_violation' },
};

// Matches +CC followed by 7-15 digits — coarse but good enough for defense-in-depth.
const PHONE_REGEX = /\+\d{7,15}/g;

function redactPhones(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(PHONE_REGEX, '[REDACTED_PHONE]');
  if (Array.isArray(value)) return value.map(redactPhones);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactPhones(v);
    return out;
  }
  return value;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err as unknown as Record<string, unknown>),
    };
  }
  return { value: err };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp();
    const res = httpCtx.getResponse<Response>();
    const req = httpCtx.getRequest<Request>();
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);

    // 1. HttpException — preserve existing code-hoist behaviour
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const bodyCode = typeof body === 'object' && body && 'code' in body ? String((body as { code: unknown }).code) : undefined;
      const bodyTitle = typeof body === 'object' && body && 'title' in body && (body as { title: unknown }).title != null
        ? String((body as { title: unknown }).title)
        : undefined;
      const problem: ProblemJson = {
        type: 'about:blank',
        title: bodyCode ?? bodyTitle ?? 'http_exception',
        status,
        detail: exception.message,
        requestId,
        ...(bodyCode ? { code: bodyCode } : {}),
        ...(typeof body === 'object' && body !== null
          ? Object.fromEntries(
              Object.entries(body as Record<string, unknown>).filter(
                ([k]) => k !== 'code' && k !== 'message' && k !== 'status' && k !== 'statusCode' && k !== 'title' && k !== 'type',
              ),
            )
          : {}),
      };
      logger.warn({ err: redactPhones(serializeError(exception)), status, requestId }, 'http exception');
      res.status(status).json(problem);
      return;
    }

    // 2. pg constraint violations — map to structured 4xx
    const pgCode = (exception as { code?: string } | null | undefined)?.code;
    if (pgCode && PG_CODE_MAP[pgCode]) {
      const mapped = PG_CODE_MAP[pgCode];
      const problem: ProblemJson = {
        type: 'about:blank',
        title: mapped.title,
        status: mapped.status,
        detail: 'Database constraint violated.',
        requestId,
        code: mapped.code,
      };
      logger.error({ err: redactPhones(serializeError(exception)), pgCode, requestId }, 'pg constraint violation');
      res.status(mapped.status).json(problem);
      return;
    }

    // 3. Anything else — generic 500, no message leak
    const problem: ProblemJson = {
      type: 'about:blank',
      title: 'internal_error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
      requestId,
      code: 'internal_error',
    };
    logger.error({ err: redactPhones(serializeError(exception)), requestId }, 'unhandled exception');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(problem);
  }
}
