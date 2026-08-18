const DEFAULT_CAPACITY = 1000;

/**
 * Bounded, in-memory, non-durable record of recently-seen Telegram update IDs. A `Map`'s
 * insertion-order iteration gives FIFO eviction for free — no timer/clock dependency needed,
 * since Telegram redelivers quickly after the original delivery, not after an arbitrary delay.
 * This is a best-effort reduction of a known redelivery pattern, not a durable guarantee.
 */
export class UpdateDedupWindow {
  readonly #capacity: number;
  readonly #seen = new Map<number, true>();

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.#capacity = capacity;
  }

  has(updateId: number): boolean {
    return this.#seen.has(updateId);
  }

  record(updateId: number): void {
    if (this.#seen.has(updateId)) {
      return;
    }
    if (this.#seen.size >= this.#capacity) {
      const oldest = this.#seen.keys().next().value;
      if (oldest !== undefined) {
        this.#seen.delete(oldest);
      }
    }
    this.#seen.set(updateId, true);
  }
}
