import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

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
