# Phase 1 Data Model: Telegram Provider Adapter

This ticket introduces no new types in `@chatter/core` (constitution Principle II) — everything
below either configures `@chatter/telegram` internally or maps onto the existing ticket #1
normalized model (`Provider`, `Account`, `Participant`, `Conversation`, `Message`,
`MessageCreatedEvent`, `Capability`, `DeliveryResult`, `AccountAdapter`).

## Configuration

### `TelegramAccountConfig`
- `botToken: string` — required. Never logged; never included in a thrown error message.
- `webhookSecret: string` — required. The value Telegram will echo back in the
  `X-Telegram-Bot-Api-Secret-Token` header on every webhook request; compared with
  `crypto.timingSafeEqual`.
- `webhookUrl: string` — the public HTTPS URL Telegram should POST updates to; passed to
  Telegram's `setWebhook` call during `start()`.

## Reference key mapping (per ticket #1 §6 / `data-model.md`)

```text
provider              = "telegram"
providerAccountId     = the bot's own numeric Telegram user ID (from getMe(), fetched once on start())
providerParticipantId = the sending Telegram user's numeric ID
providerConversationId = the Telegram chat's numeric ID (chat.id), stringified
providerThreadId       = not populated this ticket (Telegram topics are out of scope)
```

## Mapping: Telegram → normalized model

### Chat → Conversation
| Telegram `chat.type` | Chatter `Conversation.type` |
|---|---|
| `"private"` | `"direct"` |
| `"group"` | `"group"` |
| `"supergroup"` | `"group"` |
| `"channel"` (or anything else) | `"unknown"` — defensive, not expected inbound this ticket |

### User → Participant
- `Participant.providerParticipantId` = Telegram `user.id` (stringified).
- `Participant.displayName` = Telegram `user.first_name` (+ `last_name` if present), or
  `user.username` as a fallback when neither name field is present.

### Message → Message
- `Message.id` = Telegram `message.message_id` (stringified, scoped per chat as Telegram itself
  scopes it — combined with the conversation reference this remains a stable identifier for
  ticket #1's FR-013 duplicate-detection requirement).
- `Message.text` = Telegram `message.text`.
- `Message.createdAt` = Telegram `message.date` (Unix seconds) converted to a `Date`.
- `Message.replyToMessageId` = Telegram `message.reply_to_message.message_id` when present.

### Update handling
- Only `update.message` updates where `message.text` is present become a
  `MessageCreatedEvent`.
- Any other update field (`edited_message`, `channel_post`, `message_reaction`, etc.) is
  acknowledged (HTTP 200) to stop Telegram from retrying delivery, per FR-013, but produces no
  event.

## `TelegramAccountAdapter` internal state

- `botUserId: string | undefined` — populated by `getMe()` during `start()`; used to compose
  `providerAccountId` for every mapped entity. `start()` MUST fail with
  `ChatterAuthenticationError` if `getMe()` fails due to an invalid token, before attempting to
  register the webhook.
- `dispatch: ((message: InboundMessage) => void) | undefined` — set by `start()`, matching the
  `AccountAdapter` contract from ticket #1; cleared by `stop()`.
- No message content or participant data is retained beyond what's needed to process the current
  request (constitution Principle VI / NFR-012) — the adapter itself keeps no message history.

## Delivery result

`AdapterDeliveryResult.providerMessageId` = the `message_id` Telegram returns from a successful
`sendMessage` call (stringified). `timestamp` = the `date` field on Telegram's response message
object.
