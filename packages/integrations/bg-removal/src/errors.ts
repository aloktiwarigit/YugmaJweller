export class BgRemovalUnavailableError extends Error {
  constructor(message = 'Background-removal adapter is not available') {
    super(message);
    this.name = 'BgRemovalUnavailableError';
  }
}
