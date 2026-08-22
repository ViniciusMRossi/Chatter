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
- `attachments` — sending and receiving a single image, video, or file per message (see below).
- `mentions` — reporting the people referenced in an inbound message (see below). Inbound only:
  composing a mention on an outgoing message is not supported this release.

Not supported this release: `thread` (Telegram's "topics"/forum-thread feature). A send
targeting a thread reference rejects with `ChatterUnsupportedCapabilityError` rather than
silently sending to the wrong place.

## Mentions

Inbound messages carry `Message.mentions` when Telegram reports any, for both plain text
(`entities`) and media captions (`caption_entities`). Offsets are UTF-16 code units — see
`@chatter/core`'s README for the invariant and the emoji pitfall.

Telegram has two mention forms, and only one of them can be resolved to a person:

| Telegram entity | Looks like | Resolves to a `participant`? |
|---|---|---|
| `text_mention` | the person's display name | **Yes** — Telegram attaches a full user object |
| `mention` | `@alice` | **No** — Telegram attaches no user id at all |

This asymmetry is Telegram's, not a gap in this adapter. A `@handle` is not a stable identifier:
usernames can be changed or transferred to a different person. Rather than derive a participant id
from the handle — which would quietly point at whoever holds that name later — the mention is
reported with its text and position and no `participant`. Use `isSelf` to detect being addressed,
and treat `participant` as optional.

`isSelf` is determined by comparing a `text_mention`'s user id against the bot's own id, and a
`@handle` against the bot's own username (case-insensitively, as Telegram treats usernames). The
bot's username is read from the `getMe()` call `start()` already makes, so this costs no extra
request — and a `start()` that cannot reach Telegram already fails with
`ChatterAuthenticationError`, rather than starting into a state where "was I addressed?" silently
always answers no.

### `/command@botname` is deliberately not a mention

Telegram marks `/start@yourbot` with a single `bot_command` entity and never emits a mention
entity for the `@yourbot` part. This adapter therefore reports **no** mention for it, and no self
signal — reporting one would mean parsing the command text to decide a substring names a person,
which is content interpretation this library does not do (`specs/006-mentions` FR-014/FR-017).

The practical consequence: a bare `/start@yourbot` in a group does **not** tell your application
it was addressed. If you handle commands, read `Message.text` for them; mentions and commands are
separate concepts here on purpose.

## Attachments

Inbound photo/video/document/voice/audio updates are dispatched as a `Message` with a populated
`attachments` array; Telegram's `caption` field (when present) becomes `Message.text`, exactly
like a plain text message — an attachment never requires a caption. Outbound, `SendInput.attachment`
accepts either a `{ url }` reference (Telegram fetches it server-side — no bytes pass through
this adapter) or `{ data: Buffer }` for a genuine upload; `SendInput.text`, when present alongside
an attachment, becomes the outbound `caption`.

**Voice messages and audio files (receive-only)**: Telegram's `voice` (a recorded voice message,
typically `audio/ogg`) and `audio` (an uploaded music file, e.g. `audio/mpeg`) message types are
both mapped to `kind: "file"` — there's no separate `"audio"` kind in `@chatter/core`'s closed
set, since `mimeType` (usually present, but see FR-002's "don't fabricate what Telegram didn't
supply" precedent — never guaranteed) already tells application code it's playable audio via a
simple `mimeType?.startsWith("audio/")` check, without needing a new capability or Attachment
variant. **This adapter only receives voice/audio — `send()` does not offer a way to send
either**; a `SendInput.attachment` is always sent via `sendPhoto`/`sendVideo`/`sendDocument`
depending on `kind`, and since voice/audio map to `"file"`, sending one goes through
`sendDocument` (Telegram will still accept and play it as a document, just without voice-message
UI treatment on the recipient's end) rather than `sendVoice`/`sendAudio`.

**Real Telegram constraints this adapter enforces or is subject to** — not values this adapter
invented, and not something a future Telegram API change would let this adapter unilaterally
change either:

- **Send-side size limits**: directly-supplied (`{ data: Buffer }`) attachments are rejected with
  `ChatterConfigurationError` *before* any API call if they exceed Telegram's real limit for
  their kind — **10 MB for images, 50 MB for video/file**. A `{ url }`-sourced attachment isn't
  size-checked client-side (its size isn't knowable in advance); if Telegram itself rejects it,
  that surfaces through this adapter's normal error mapping, not a special case.
- **Download cap, independent of the send-side limit**: resolving a received attachment's
  download URL goes through Telegram's `getFile`, which **refuses anything over 20 MB regardless
  of the file's original size** — a 45 MB video Telegram happily accepted on the way in cannot be
  re-downloaded through this mechanism at all.
- **Download URLs are temporary**: a resolved `Attachment.source.url` is guaranteed valid for
  only about an hour. This adapter does not attempt to refresh or extend it — an application
  needing the content later should fetch it promptly.
- **Download URLs are sensitive — treat them like a credential, not a public link**: Telegram's
  file-download mechanism has no way to produce a downloadable URL without embedding the bot's
  own token directly in it (`https://api.telegram.org/file/bot<token>/<path>`). A resolved
  `Attachment.source.url` must never be logged, displayed in a debugging tool, or forwarded to an
  untrusted party — for roughly the next hour, whoever holds that URL can act as the bot. This
  adapter itself never logs a resolved URL at any level; the same care must be exercised by any
  application code the URL reaches.

## Known limitations

- Telegram **channels** (as distinct from groups/supergroups) are not handled this release —
  their conversation type maps defensively to `"unknown"` rather than crashing, but channel
  posting/reading isn't a supported flow yet.
- Message edits, deletions, reactions, and interactive components (inline keyboards, commands)
  are not normalized this release. Mentions are inbound-only — see Mentions above; composing a
  mention on an outgoing message is not supported.
- Only a single attachment per message is supported (matching `@chatter/core`'s own
  one-attachment-per-send contract) — no multi-attachment albums.
- Only webhook-based delivery is supported; long polling is not implemented.

## Error mapping

Telegram Bot API failures are mapped onto `@chatter/core`'s typed error hierarchy:

| Condition | Error |
|---|---|
| Invalid/revoked bot token | `ChatterAuthenticationError` |
| Unknown chat, or bot blocked/kicked | `ChatterInvalidTargetError` |
| Group chat migrated to a supergroup | `ChatterInvalidTargetError` — new chat ID included in the message text (no structured field; see below) |
| Outbound text over 4096 characters | `ChatterConfigurationError` — rejected before any API call |
| Flood control (rate limit) | `ChatterRateLimitError` (with `retryAfterMs`) |
| Network failure / Telegram outage | `ChatterProviderUnavailableError` (`retryable: true`) |
| Anything else | `ChatterUnknownError` |

The bot token and webhook secret never appear in any thrown error's message, at any point.

## Duplicate webhook deliveries

Telegram occasionally redelivers the same update (e.g. if your server's response was slow).
This adapter tracks the last 1000 processed `update_id`s in memory and skips dispatching a
redelivered one a second time (the request is still acknowledged with `200` either way, so
Telegram doesn't keep retrying). This is a best-effort, non-durable reduction of a known,
common redelivery pattern — not a durable exactly-once guarantee. If your application needs
stronger deduplication (e.g. across restarts), track message IDs yourself; this mirrors
`@chatter/core`'s own stance that durable deduplication is an application concern.

## Chat migration (group → supergroup)

Telegram silently changes a group's chat ID when it's upgraded to a supergroup. A send to the
old ID fails; this adapter surfaces the new chat ID in the resulting `ChatterInvalidTargetError`'s
message (e.g. `"...new chat ID: -1001234567890"`) so your application can update its stored
reference and retry. There's no structured field for this yet — parse the message if you need
to automate the reaction.

## Non-fatal cleanup failures

`stop()` always resolves without throwing, even if removing the webhook registration
(`deleteWebhook`) fails — but that failure isn't silently discarded. Pass `onNonFatalError` to
the constructor to observe it (receives a pre-sanitized message string, never the raw error or
either secret); if you don't provide one, it defaults to `console.error`:

```ts
const adapter = new TelegramAccountAdapter(config, {
  onNonFatalError: (message) => logger.warn({ message }, "telegram adapter cleanup issue"),
});
```

## Message edits and deletions

This adapter declares `"editNotifications"`, `"editMessage"` and `"deleteMessage"`. See
[`@chatter/core`'s README](../core/README.md#message-edits-and-deletions) for the normalized
model; the Telegram-specific behavior is below.

### Inbound edits

`edited_message` updates dispatch as `"message.edited"`, carrying the message's content as of
the edit under the same id it was first delivered with. `edit_date` becomes `Message.editedAt`;
`date` continues to supply `createdAt` and is never overwritten.

Mentions are recomputed from the edited message, so an edit that adds or removes a mention is
reflected — including reporting no `mentions` key at all when an edit removed the only one. The
`entities`/`caption_entities` rule is unchanged from mentions: both are chosen by the same
branch that chooses text vs caption.

`edited_channel_post` is **not** handled, because inbound `channel_post` is not handled either —
an edit of one would be an edit of a message this adapter never delivered. Channel posts are
their own feature.

Redelivered edits are suppressed by the existing `update_id` dedup window, which runs before any
update-type branching.

### Editing costs one round trip for text, two for a caption

Telegram has separate endpoints for the two, and this adapter picks by **asking**, not assuming:
it calls `editMessageText`, and only on Telegram's specific
`there is no text in the message to edit` does it retry with `editMessageCaption`.

It has to work this way. Chatter keeps no record of the messages it has sent, and the Bot API
gives bots no way to fetch a message by id — so the provider is the only available source of
truth about which field a message has. Editing a caption therefore costs two calls. Editing
text, the common case, costs one.

The fallback triggers on that one description alone. A blanket retry-on-failure would double
every failed edit and could report a caption error for a text message. If the caption attempt
also fails, **its** error surfaces — it is the call that made the real attempt.

### Failure categories

| Telegram answer | Raised as |
|---|---|
| `message to edit/delete not found` | `ChatterInvalidTargetError` |
| `message can't be edited/deleted` | `ChatterAuthorizationError` |
| `message can't be deleted for everyone` (past the window) | `ChatterAuthorizationError` |
| `message is not modified` | `ChatterConfigurationError` |
| `chat not found`, blocked/kicked | `ChatterInvalidTargetError` |
| 429 | `ChatterRateLimitError` with `retryAfterMs` |

Two of those rows are worth knowing about:

- **`message is not modified` is a rejection, not a success.** See the core README for why, and
  for the `catch` an application that edits on a timer will need.
- **The elapsed-time refusal shares `ChatterAuthorizationError`.** Telegram reports it as a
  permission failure rather than a distinct code, so there is nothing finer to map it onto
  without inventing a distinction the provider is not making. The provider's own wording is
  preserved in the error message and the underlying `GrammyError` is attached as `cause`.

### No local pre-judgement of Telegram's time windows

Telegram limits how long a bot may delete another participant's message. This adapter does
**not** check that locally — it attempts the operation and reports the answer. A window
evaluated against a local clock is wrong near the boundary whenever clocks disagree, and would
refuse operations Telegram would have accepted.

This is not inconsistent with the message-length and attachment-size checks `send()` makes
before calling out: those are knowable locally and cannot change between the check and the call.
Elapsed time is neither.

## Verifying against a real bot

The automated test suite runs entirely against a stubbed transport (no real Telegram
credentials, ever, in CI). See `MANUAL-VERIFICATION.md` for the human-run checklist that proves
this adapter actually works against Telegram's real servers.

## API reference (Bruno)

Every HTTP endpoint this adapter touches — the outbound Telegram Bot API calls (`getMe`,
`setWebhook`, `deleteWebhook`, `sendMessage`) and the inbound webhook contract — is documented as
a runnable [Bruno](https://www.usebruno.com/) collection at
[`bruno/telegram-adapter/`](../../bruno/telegram-adapter). See [`bruno/README.md`](../../bruno/README.md)
for setup.

The `local-webhook/` folder (dedup, direct/group mapping, secret validation — no real Telegram
credentials needed) doubles as an automated test suite, run in CI and locally via:

```bash
pnpm run test:bruno
```

This starts a throwaway stub-backed server (`tests/bruno/webhook-test-server.ts`), runs the
collection against it, then tears it down.
