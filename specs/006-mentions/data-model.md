# Phase 1 Data Model: Mentions

## New entity: `Mention`

`packages/core/src/types/mention.ts`

```ts
import type { Participant } from "./participant.js";

export interface Mention {
  /**
   * The mention exactly as it appears in the message text — e.g. "@alice" for a handle
   * mention, or the display name for a mention of a user with no public handle.
   * Always equals `message.text.slice(offset, offset + length)`.
   */
  readonly text: string;
  /**
   * Start of the mention within `message.text`, in UTF-16 code units — the same unit
   * JavaScript string indexing uses, so `slice(offset, offset + length)` is correct as
   * written. NOT code points: `"👋 @alice"` puts "@alice" at offset 3, not 2.
   */
  readonly offset: number;
  /** Length of the mention in UTF-16 code units. */
  readonly length: number;
  /**
   * The referenced person, when the provider identifies them. Absent when the provider
   * reports a mention it cannot resolve to a specific account — notably Telegram's plain
   * `@handle` form, which carries no user id. Never populated with a synthesized or
   * handle-derived identifier.
   */
  readonly participant?: Participant;
  /** Whether this mention refers to the connected account itself. */
  readonly isSelf: boolean;
}
```

### Field rules

| Field | Rule | Source requirement |
|---|---|---|
| `text` | MUST equal the message text sliced at this mention's own position | FR-003, FR-004, SC-003 |
| `offset`, `length` | UTF-16 code units, relative to `Message.text` | FR-004, FR-005 |
| `offset`, `length` | MUST lie within the message text; out-of-range entities are skipped entirely, not clamped | FR-015 |
| `participant` | Present iff the provider supplied an identity; never fabricated | FR-006, FR-007, SC-004 |
| `isSelf` | Required, not optional — every mention answers the question | FR-008 |

`isSelf` is deliberately **required** rather than optional. An optional boolean has three states
(`true`/`false`/`undefined`) for a two-state question, and consumer code written as `if
(m.isSelf)` would silently treat "not yet determined" as "not me". Since FR-018 guarantees the
connected account's identity is always known before any message is mapped, there is no legitimate
third state to represent.

## Modified entity: `Message`

`packages/core/src/types/message.ts` — one added field, everything else unchanged.

```ts
readonly mentions?: readonly Mention[];
```

**Ordering**: ascending by `offset`, i.e. the order the mentions appear in the text (FR-001).

**Absence**: a message with no mentions omits the field entirely rather than carrying `[]` (FR-002).
This keeps messages byte-identical in shape to pre-feature messages for the overwhelmingly common
no-mention case, and matches the existing conditional-spread convention already used in
`mapMessage` for `text`, `attachments`, and `replyToMessageId`.

## Modified entity: `Capability`

`packages/core/src/types/capability.ts`

```ts
export type Capability = "text" | "reply" | "thread" | "attachments" | "mentions";
```

Declared by an adapter when it reports mentions on inbound messages. Note this capability describes
**inbound reporting only** — composing an outbound mention is out of scope for this feature, so an
adapter declaring `"mentions"` is making no claim about send-side support.

## Unchanged entities

- **`Participant`** — reused as-is as the target of a resolved mention. No new fields.
- **`Attachment`**, **`Conversation`**, **`DeliveryResult`** — untouched.
- **`SendInput`** — untouched; outbound mention formatting is out of scope.

## Provider mapping: Telegram

`MessageEntity` → `Mention`, applied to `message.entities` for text messages and
`message.caption_entities` for captioned attachments (selected in lockstep with the text choice —
see research.md §5).

| `entity.type` | Produces | `participant` | `isSelf` determined by |
|---|---|---|---|
| `text_mention` | Mention | `mapParticipant(entity.user, …)` | `String(entity.user.id) === botUserId` |
| `mention` | Mention | *(absent)* | `text.slice(1).toLowerCase() === botUsername?.toLowerCase()` |
| `bot_command` | *(nothing)* | — | — (FR-017) |
| any other | *(nothing)* | — | — |

### Adapter state

`TelegramAccountAdapter` gains one private field, `#botUsername: string | undefined`, populated from
the same `getMe()` response that already populates `#botUserId` in `start()`. It stays `undefined`
only if Telegram reports a bot with no username — in which case the handle form simply never matches
self, which is correct rather than an error.
