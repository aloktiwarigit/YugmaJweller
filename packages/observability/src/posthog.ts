import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function initPosthog(apiKey?: string, host?: string): void {
  if (!apiKey) return;
  _client = new PostHog(apiKey, { host: host ?? 'https://app.posthog.com' });
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!_client) return;
  const msg = properties !== undefined
    ? { distinctId, event, properties }
    : { distinctId, event };
  _client.capture(msg);
}

export async function shutdownPosthog(): Promise<void> {
  await _client?.shutdown();
}
