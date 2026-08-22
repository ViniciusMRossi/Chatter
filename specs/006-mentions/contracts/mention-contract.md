# Contract: mention additions across `@chatter/core`, `@chatter/testing`, `@chatter/telegram`

A diff against the prior tickets' contracts — everything not listed here is unchanged. Signatures
are illustrative; naming refinements are allowed as long as behavior matches.

## `@chatter/core` (new public surface)

### `Mention` (new, exported)

```ts
export interface Mention {
  readonly text: string;
  readonly offset: number;   // UTF-16 code units, into Message.text
  readonly length: number;   // UTF-16 code units
  readonly participant?: Participant;
  readonly isSelf: boolean;
}
```

Invariants every producer MUST satisfy:

- `message.text!.slice(m.offset, m.offset + m.length) === m.text` — exactly, for every mention.
- `m.offset >= 0` and `m.offset + m.length <= message.text!.length`.
- `m.participant` is absent rather than a fabricated/handle-derived identity when the provider
  supplies no id.
- `m.isSelf` is always a boolean, never `undefined`.

### `Message` (field added)

```ts
readonly mentions?: readonly Mention[];   // ascending by offset; omitted entirely when none
```

### `Capability` (union widened)

```ts
export type Capability = "text" | "reply" | "thread" | "attachments" | "mentions";
```

`"mentions"` asserts inbound mention reporting only. It makes no claim about outbound mention
composition, which is out of scope for this feature.

## `@chatter/testing`

### `ConformanceSuiteConfig` (field added, optional)

```ts
/**
 * Causes the adapter to dispatch one inbound message exercising mentions: at least one
 * resolved mention, one unresolved mention, and one mention of the adapter's own account.
 * REQUIRED for adapters declaring the "mentions" capability — the suite fails without it
 * rather than skipping, so the contract cannot be declared and left unverified.
 */
readonly emitInboundWithMentions?: (adapter: AccountAdapter) => void | Promise<void>;
```

### `runAccountConformanceSuite()` (checks added, signature unchanged)

For an adapter declaring `"mentions"`, the suite MUST additionally verify:

- The hook is supplied — otherwise fail with an explicit message naming the missing hook.
- Every dispatched mention satisfies the slice invariant above.
- Mentions are ordered ascending by `offset`.
- At least one mention carries a `participant`, and at least one carries none — proving both
  branches are reachable rather than assumed.
- No mention carries a participant whose `providerParticipantId` is empty or placeholder-like.
- Exactly the mention(s) referring to the connected account have `isSelf === true`.

For an adapter **not** declaring `"mentions"`, the suite MUST verify that inbound messages carry no
`mentions` field — the existing skip-when-undeclared pattern, applied to the negative branch.

### `FakeAccountAdapter` (behavior extended)

- Gains the ability to be constructed with and without `"mentions"` in its capability set, so both
  conformance branches are genuinely exercised.
- Gains a test helper to emit an inbound message carrying resolved, unresolved, and self mentions.

## `@chatter/telegram`

### `TelegramAccountAdapter.getCapabilities()` (behavior extended, signature unchanged)

Returns `{"text", "reply", "attachments", "mentions"}` — was `{"text", "reply", "attachments"}`.

### `TelegramAccountAdapter.start()` (behavior extended, signature unchanged)

- MUST capture `me.username` from the `getMe()` response it already makes, alongside the `me.id` it
  already stores.
- Failure to obtain identity continues to throw `ChatterAuthenticationError` — unchanged existing
  behavior, now load-bearing for FR-018.

### `TelegramAccountAdapter.mapInboundMessage()` (behavior extended, signature unchanged)

- MUST pass the bot's username through to `mapMessage` alongside the existing bot user id.

### `mapping/mention.ts` (new, internal — not part of the adapter's public contract)

```ts
function mapMentions(
  entities: readonly MessageEntity[] | undefined,
  text: string | undefined,
  providerAccountId: string,
  botUsername: string | undefined,
  onMalformed?: (message: string) => void,
): readonly Mention[] | undefined;
```

- Returns `undefined` — not `[]` — when there are no mentions, so callers can conditionally spread.
- MUST map `text_mention` to a resolved mention via the existing `mapParticipant`.
- MUST map `mention` to a mention with no `participant`.
- MUST NOT map `bot_command`, or any other entity type, to a mention.
- MUST skip (never clamp) any entity whose `offset`/`length` falls outside `text`, reporting it via
  `onMalformed` when supplied.
- MUST determine `isSelf` by user-id equality for `text_mention`, and by case-insensitive
  username equality — with the leading `@` stripped — for `mention`.
- MUST preserve provider-supplied order.

### `mapping/message.ts` (behavior extended)

- MUST select `caption_entities` in exactly the branch that selects `caption`, and `entities` in the
  branch that selects `text` — never independently. See research.md §5.
- MUST spread `mentions` conditionally, matching the existing `text`/`attachments` convention.
