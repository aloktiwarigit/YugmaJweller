export class PaymentsAdapterError extends Error {
  constructor(
    public readonly adapter: string,
    cause: Error,
  ) {
    super(`Payments adapter '${adapter}' error: ${cause.message}`);
    this.name = 'PaymentsAdapterError';
    this.cause = cause;
  }
}

export class PaymentsUnavailableError extends Error {
  constructor(public readonly adapter: string) {
    super(`Payments adapter '${adapter}' unavailable`);
    this.name = 'PaymentsUnavailableError';
  }
}
