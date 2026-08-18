# Contract: `@chatter/telegram` public API (Phase 2)

Signatures below are illustrative of required shape and behavior, not final naming approved
character-for-character — same ground rule as ticket #1's `core-api.md`.

## `TelegramAccountAdapter`

```ts
class TelegramAccountAdapter implements AccountAdapter {
  constructor(config: TelegramAccountConfig);

  readonly provider = "telegram";
  getCapabilities(): ReadonlySet<Capability>; // { "text", "reply" } — never "thread"

  start(dispatch: (message: InboundMessage) => void): Promise<void>;
  // MUST call Telegram's getMe() to resolve the bot's own account ID, throwing
  // ChatterAuthenticationError on failure, THEN register the webhook (setWebhook) with the
  // configured webhookUrl and webhookSecret, before resolving.

  stop(): Promise<void>;
  // MUST remove the webhook registration (deleteWebhook) and clear the stored dispatch
  // callback. MUST NOT throw if start() never completed (per spec Edge Cases).

  send(input: SendInput): Promise<AdapterDeliveryResult>;
  // Maps to Telegram's sendMessage, using reply_parameters when input.replyToMessageId is set.
  // MUST reject with a mapped ChatterError (see research.md's mapping table) on any failure —
  // never a raw grammY error.
}
```

Implements `@chatter/core`'s `AccountAdapter` exactly as defined in ticket #1 — no changes to
that interface.

## Webhook handler

```ts
function createTelegramWebhookHandler(adapter: TelegramAccountAdapter): (
  request: Request
) => Promise<Response>;
```

- MUST read the `X-Telegram-Bot-Api-Secret-Token` header and compare it against the adapter's
  configured secret with `crypto.timingSafeEqual` BEFORE any further processing of the request
  body. A missing or mismatched header returns an HTTP 401 `Response` and dispatches nothing.
- On success, parses the Telegram `Update` body and, if it contains a text message, calls the
  `dispatch` callback registered via `start()` with the mapped `InboundMessage`. Any other
  update type is acknowledged (200) without dispatching anything (FR-013).
- Always returns a `Response` (never throws) so the host application's HTTP framework of choice
  can forward it directly — this is what makes it "framework-independent" per FR-002.

## `TelegramAccountConfig`

```ts
interface TelegramAccountConfig {
  readonly botToken: string;
  readonly webhookSecret: string;
  readonly webhookUrl: string;
}
```

`botToken` and `webhookSecret` MUST NOT appear in any thrown error's `message`, nor in any log
output the adapter itself produces, at any point — including inside error paths that wrap a
grammY-originated failure (research.md's error-mapping decision exists specifically to prevent
this: raw grammY errors are never passed through unwrapped).

## Reuse from `@chatter/core` and `@chatter/testing` (no changes)

- `AccountAdapter`, `SendInput`, `AdapterDeliveryResult`, `InboundMessage`, `Capability`,
  `ConversationType`, and the full `ChatterError` hierarchy are consumed exactly as ticket #1
  defined them.
- `runAccountConformanceSuite` from `@chatter/testing` is imported and run unmodified against
  `TelegramAccountAdapter` (with its outbound transport stubbed per research.md), proving FR-009.
