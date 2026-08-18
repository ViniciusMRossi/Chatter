# Contract: `@chatter/telegram` additions (Phase 3 hardening)

This is a diff against ticket #2's `specs/002-telegram-adapter/contracts/telegram-adapter-api.md`
— everything not listed here is unchanged. As before, signatures are illustrative; naming
refinements are allowed as long as behavior matches.

## `TelegramAccountAdapterOptions` (extended, backward compatible)

```ts
interface TelegramAccountAdapterOptions {
  readonly api?: Api;
  readonly onNonFatalError?: (message: string) => void; // NEW — default: console.error
}
```

- MUST NOT ever receive the bot token or webhook secret, or any raw provider error object — only
  a pre-sanitized string message (see FR-006).
- MUST be called for a `deleteWebhook` failure during `stop()`, and MUST NOT cause `stop()` to
  reject.

## `TelegramAccountAdapter` (extended)

```ts
class TelegramAccountAdapter implements AccountAdapter {
  // ... everything from ticket #2, unchanged ...

  /** Internal — not part of the AccountAdapter contract. Used by the webhook handler. */
  hasProcessedUpdate(updateId: number): boolean;
  recordProcessedUpdate(updateId: number): void;
}
```

- `send()` MUST reject with `ChatterConfigurationError` (not a network call) when `input.text`
  exceeds 4096 characters.
- `send()`'s existing error-mapping path MUST surface a migration-signaled failure's new chat ID
  in the resulting `ChatterInvalidTargetError`'s message (see research.md for exact wording).

## `createTelegramWebhookHandler` (behavior extended, signature unchanged)

Still `(request: Request) => Promise<Response>`. Adds: after secret validation and `Update`
parsing, before dispatch, checks `adapter.hasProcessedUpdate(update.update_id)`; if already seen,
returns `200` without dispatching; otherwise records it and dispatches as before.

## `MANUAL-VERIFICATION.md` (new)

Not code — a documentation deliverable. A checklist a human runs against a real Telegram bot,
covering (at minimum, per FR-008): webhook registration succeeding against Telegram's real
servers, a direct-chat round trip, and a group-chat round trip.
