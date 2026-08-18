# @chatter/telegram

The Telegram provider adapter for [Chatter](../../README.md) — implements `@chatter/core`'s
`AccountAdapter` contract on top of Telegram's Bot API, using a webhook transport.

## Setup

### 1. Create a bot and get a token

Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the
prompts. BotFather gives you a token that looks like `123456789:AAExampleTokenValue` — this is
your `botToken`. Treat it as a secret: never commit it, never log it.

### 2. Choose a webhook secret

Pick any random string yourself (it doesn't come from Telegram) — this is your
`webhookSecret`. Chatter uses it to verify that inbound webhook requests genuinely came from the
webhook you registered, not from anyone who discovers your URL.

### 3. Expose a public HTTPS URL

Telegram requires HTTPS and delivers updates by POSTing to a URL you register. In production
this is your server's real public URL. For local development, use a tunnel (e.g.
[ngrok](https://ngrok.com/)): `ngrok http 3000`, then use the HTTPS URL it gives you.

### 4. Register the account with Chatter

```ts
import { Chatter } from "@chatter/core";
import { TelegramAccountAdapter, createTelegramWebhookHandler } from "@chatter/telegram";

const adapter = new TelegramAccountAdapter({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET!,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL!, // e.g. "https://your-tunnel.ngrok.app/telegram-webhook"
});

const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter }] });
const webhookHandler = createTelegramWebhookHandler(adapter);

await chatter.start(); // registers the webhook with Telegram
```

`webhookHandler` is a plain `(request: Request) => Promise<Response>` function — wire it into
any HTTP framework, or Node's raw `http` module (see `example-apps/telegram-echo` for a minimal
example using Node's `http`).

## Required permissions

No special bot permissions are needed for direct chats. To receive messages in a **group**,
either disable the bot's group privacy mode via BotFather (`/setprivacy` → Disable), or have
group members @-mention the bot — otherwise Telegram won't forward ordinary group messages to
your bot at all. This is a Telegram platform behavior, not something Chatter controls.

## Supported capabilities

- `text` — sending and receiving plain text messages.
- `reply` — replying to a specific prior message (Telegram's native reply-to-message feature).

Not supported this release: `thread` (Telegram's "topics"/forum-thread feature). A send
targeting a thread reference rejects with `ChatterUnsupportedCapabilityError` rather than
silently sending to the wrong place.

## Known limitations

- Telegram **channels** (as distinct from groups/supergroups) are not handled this release —
  their conversation type maps defensively to `"unknown"` rather than crashing, but channel
  posting/reading isn't a supported flow yet.
- Message edits, deletions, reactions, and interactive components (inline keyboards, commands)
  are not normalized this release.
- Attachments/media are not yet represented — only text messages are normalized.
- Only webhook-based delivery is supported; long polling is not implemented.

## Error mapping

Telegram Bot API failures are mapped onto `@chatter/core`'s typed error hierarchy:

| Condition | Error |
|---|---|
| Invalid/revoked bot token | `ChatterAuthenticationError` |
| Unknown chat, or bot blocked/kicked | `ChatterInvalidTargetError` |
| Flood control (rate limit) | `ChatterRateLimitError` (with `retryAfterMs`) |
| Network failure / Telegram outage | `ChatterProviderUnavailableError` (`retryable: true`) |
| Anything else | `ChatterUnknownError` |

The bot token and webhook secret never appear in any thrown error's message, at any point.
