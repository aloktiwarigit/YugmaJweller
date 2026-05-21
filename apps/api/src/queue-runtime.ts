export function areQueueWorkersEnabled(): boolean {
  const explicit = process.env['BULLMQ_WORKERS_ENABLED'];
  if (explicit !== undefined) {
    return explicit === '1' || explicit.toLowerCase() === 'true';
  }
  return process.env['NODE_ENV'] !== 'production';
}
