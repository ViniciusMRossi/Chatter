# Phase 1 Data Model: Telegram Adapter Hardening

No changes to `@chatter/core`'s normalized model or `@chatter/telegram`'s existing mapped types
(`Conversation`, `Participant`, `Message`, `DeliveryResult`). This ticket adds one small internal
primitive and extends existing behavior; nothing new crosses the adapter's public boundary except
the one additive constructor option from research.md.

## `UpdateDedupWindow` (new, internal to `@chatter/telegram`)

```ts
class UpdateDedupWindow {
  constructor(capacity?: number); // default 1000
  has(updateId: number): boolean;
  record(updateId: number): void; // no-op if already present; evicts oldest if at capacity
}
```

Owned by `TelegramAccountAdapter` (one instance per adapter instance — dedup scope is per
account, matching ticket #1's multi-account isolation). Never exposed publicly; not part of the
`AccountAdapter` contract.

## `TelegramAccountAdapterOptions` (extended)

```ts
interface TelegramAccountAdapterOptions {
  readonly api?: Api;                          // unchanged from ticket #2
  readonly onNonFatalError?: (message: string) => void; // NEW, optional, defaults to console.error
}
```

Purely additive — every ticket #2 call site (`new TelegramAccountAdapter(config)` or
`new TelegramAccountAdapter(config, { api })`) continues to work unchanged.

## Error message shape (no new type, message content only)

`ChatterInvalidTargetError` thrown for a migration-signaled failure carries a message of the
form:

```text
Telegram target invalid: chat migrated to supergroup, new chat ID: <id>
```

`ChatterConfigurationError` thrown for an oversized message carries a message of the form:

```text
Telegram message text exceeds the 4096-character limit (got <n> characters)
```

Both are plain `Error.message` strings — no new fields, no new classes, consistent with FR-007.

## Webhook handler internal data flow (updated)

`createTelegramWebhookHandler` already parses the `Update` body before dispatching. This ticket
adds one step: before calling `adapter.dispatchInbound(...)`, check
`adapter.hasProcessedUpdate(update.update_id)` (a new small adapter method, internal-facing but
technically public since TypeScript has no package-private — documented as "not part of the
`AccountAdapter` contract, do not depend on it" the same way `dispatchInbound` and
`validateWebhookSecret` already are from ticket #2). If already processed, skip dispatch but
still return HTTP 200 (Telegram must not be told to keep retrying). Otherwise, record it via
`adapter.recordProcessedUpdate(update.update_id)` and dispatch as before.
