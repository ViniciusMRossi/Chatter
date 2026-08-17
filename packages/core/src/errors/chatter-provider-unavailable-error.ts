import { ChatterError } from "./chatter-error.js";

export class ChatterProviderUnavailableError extends ChatterError {
  readonly retryable: boolean;

  constructor(message: string, options?: { cause?: unknown; retryable?: boolean }) {
    super(message, options);
    this.retryable = options?.retryable ?? true;
  }
}
