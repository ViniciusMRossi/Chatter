import { ChatterError } from "./chatter-error.js";

export class ChatterRateLimitError extends ChatterError {
  readonly retryable = true;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, options?: { cause?: unknown; retryAfterMs?: number }) {
    super(message, options);
    this.retryAfterMs = options?.retryAfterMs;
  }
}
