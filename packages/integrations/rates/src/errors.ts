export class RatesAdapterError extends Error {
  constructor(public readonly adapter: string, cause?: unknown) {
    super(`Rates adapter '${adapter}' failed`);
    this.name = 'RatesAdapterError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly adapter: string) {
    super(`Circuit breaker open for adapter '${adapter}'`);
    this.name = 'CircuitOpenError';
  }
}

export class RatesUnavailableError extends Error {
  constructor() {
    super('All rate sources unavailable');
    this.name = 'RatesUnavailableError';
  }
}
