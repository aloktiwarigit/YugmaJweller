import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initOtel(serviceName: string): NodeSDK | undefined {
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return undefined;
  const sdk = new NodeSDK({
    serviceName,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return sdk;
}
