import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { trace, SpanStatusCode, type Tracer, type Attributes } from '@opentelemetry/api';

let _sdk: NodeSDK | undefined;

export function initOtel(serviceName: string): NodeSDK | undefined {
  if (_sdk) return _sdk;
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return undefined;
  _sdk = new NodeSDK({
    serviceName,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  _sdk.start();
  return _sdk;
}

export function getTracer(name = 'goldsmith-api'): Tracer {
  return trace.getTracer(name);
}

/**
 * Wraps an async operation in an OTel span.
 * Records exceptions and sets ERROR status automatically.
 * No-op (calls fn directly) when OTel is not initialised.
 */
export async function withSpan<T>(
  spanName: string,
  attributes: Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  return getTracer().startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error)?.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
