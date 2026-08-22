# Phase 0 Research: Mentions

Findings that shaped the design. Each entry records the decision, why, and what was rejected.

## 1. Offset units — UTF-16 code units, matching JS natively

**Decision**: Store and expose `offset`/`length` exactly as Telegram supplies them, and document
them as UTF-16 code units. Extraction is `text.slice(offset, offset + length)`.

**Rationale**: The Bot API defines entity offsets as "offset in UTF-16 code units to the start of
the entity". JavaScript strings *are* UTF-16 code unit sequences, and `String.prototype.slice`
indexes by code unit — so Telegram's convention and JS's native indexing coincide exactly. No
conversion is needed, and adding one would actively break the common case.

This is worth stating explicitly because the instinct to "handle Unicode properly" leads to
`[...text]` or `Array.from(text)`, both of which index by **code point**, not code unit. Those
differ the moment a message contains an emoji or any other astral-plane character before the
mention: `"👋 @alice"` has `@alice` at code-unit offset 3 but code-point offset 2. Telegram reports
3. Iterating by code point would shift every subsequent mention left by one per preceding astral
character, producing off-by-N slices that look correct in ASCII tests and silently corrupt in real
chats. SC-003 exists to pin this down with an emoji case.

**Alternatives rejected**:
- Normalize to code-point offsets — breaks the natural JS operation for no consumer benefit, and
  would have to be undone by any consumer wanting to slice the string.
- Expose a pre-sliced `text` only, no offsets — loses the ability to strip or rewrite mentions in
  place, which is a primary reason applications want positions at all.

## 2. Which Telegram entity kinds are mentions

**Decision**: `mention` → unresolved mention. `text_mention` → resolved mention. `bot_command` →
not a mention. Everything else → ignored.

**Rationale**: Telegram models these as distinct entity types with genuinely different information
content:

| Entity type | Text form | Carries `user`? | Maps to |
|---|---|---|---|
| `mention` | `@alice` | No | Mention with text + position, **no** participant |
| `text_mention` | display name, no `@` | Yes (full `User`) | Mention with a resolved `Participant` |
| `bot_command` | `/start@mybot` | No | Nothing (FR-017) |

`text_mention` is how Telegram represents a mention of a user who has no public username — the
client renders their display name as a link and the API attaches the `User` object. `mention` is
the ordinary `@handle` form, and the API attaches **no** user id, because a handle is not a stable
identifier: it can be changed or transferred. Fabricating an id from the handle (FR-007) would
therefore mint an identifier that silently reassigns itself to a different human when a username
changes hands — the exact failure the prohibition exists to prevent.

**Alternatives rejected**:
- Treating `@handle` as a resolvable id by calling `getChat(@handle)` to look the user up — an extra
  network call per mention, rate-limit exposed, fails for users the bot cannot see, and turns a pure
  mapping function into an async provider-dependent one. Rejected as scope and fragility.
- Including `bot_command` — see §3.

## 3. `/command@botname` is not a mention

**Decision**: Produce no mention, and do not raise the self-addressed signal for it (FR-017).

**Rationale**: Telegram emits a single `bot_command` entity spanning the whole `/start@mybot` token.
It never emits a `mention` entity for the `@mybot` part. Reporting a mention there means Chatter
deciding, on its own, that a substring of a command entity denotes a person — which is text
interpretation, and directly contradicts FR-014 in the same specification.

The accepted cost is real and is recorded in FR-017 rather than hidden: a bot receiving a bare
`/start@mybot` in a group is not told it was addressed. The right future fix is a separately
specified "command targeting" concept that reports the command and its target bot as what they
actually are, not a mention that pretends a command was a person reference. Loosening FR-014 to get
there would be the wrong trade.

**Alternatives rejected**:
- Emit an unresolved mention spanning the `@mybot` substring — convenient, but requires Chatter to
  locate `@` inside the command text itself, i.e. exactly the text-parsing FR-014 forbids.
- Emit no mention but set a message-level "addressed" flag — defensible, but widens the model beyond
  FR-008 (which puts the flag on the mention) for one provider's command syntax.

## 4. Self-detection needs the bot's own username, not just its id

**Decision**: `start()` captures `me.username` alongside the `me.id` it already stores. `isSelf` is
true when a `text_mention`'s user id equals the bot's id, **or** when a `mention`'s handle equals the
bot's username, compared case-insensitively with the leading `@` stripped.

**Rationale**: The two entity kinds carry different information, so they need different comparisons.
Id comparison alone would miss the overwhelmingly common `@mybot` form, which carries no id at all —
i.e. the feature's headline use case would silently never fire.

Verified in the existing code before deciding: `TelegramAccountAdapter.start()` **already** calls
`this.#api.getMe()` and already throws `ChatterAuthenticationError` on failure, storing
`String(me.id)` as `#botUserId`. So capturing `me.username` from the same response adds no call, no
new failure mode, and no new startup dependency — FR-018 codifies behavior that already exists
rather than introducing it.

Telegram usernames are case-insensitive and unique; the API returns the canonical casing, but a user
typing `@MyBot` produces entity text with their casing. Comparison must therefore lowercase both
sides. `username` is optional on `User` in the API type — a bot always has one in practice, but the
type is honest about it, so the mapping must handle `undefined` by simply never matching the handle
form rather than by asserting.

**Alternatives rejected**:
- Requiring the bot username in `TelegramAccountConfig` — duplicates a value the API already returns
  authoritatively, and invites configuration drift when a bot is renamed.
- Comparing display names — display names are neither unique nor stable.

## 5. Caption entities must be selected in lockstep with the text choice

**Decision**: In `mapMessage`, choose `caption_entities` in exactly the same branch that chooses
`caption`, and `entities` in the branch that chooses `text`.

**Rationale**: This is the highest-risk correctness detail in the ticket. `mapMessage` currently
collapses two provider fields into one normalized `text`:

```ts
const text = attachment !== undefined ? message.caption : message.text;
```

Telegram supplies a *separate* entity array per field: `entities` indexes into `text`,
`caption_entities` indexes into `caption`. Reading the wrong one yields offsets computed against a
string the message does not expose — which does not throw, does not fail a naive test where both
strings happen to be similar, and produces mentions whose `text` field disagrees with the slice at
their own offset. Deriving both from a single decision makes the invariant structural rather than
something a future edit can drift out of sync (SC-003, FR-010).

**Alternatives rejected**:
- Concatenating both entity arrays — offsets would be meaningless across two different strings.
- Exposing caption and text as separate normalized fields — a breaking change to `Message` and
  outside this ticket's scope.

## 6. The conformance suite cannot currently test inbound behavior at all

**Decision**: Extend `ConformanceSuiteConfig` with an optional
`emitInboundWithMentions?: (adapter) => void | Promise<void>` hook. Adapters declaring `"mentions"`
must supply it; the suite fails with an explicit message if they do not.

**Rationale**: The existing suite is entirely `send()`-oriented — every check starts an adapter,
sends, and asserts on the `DeliveryResult`. It has no mechanism to observe a *dispatched inbound*
message, because no prior ticket needed one. Mentions are inbound-only, so without this extension
"conformance coverage" for FR-012 would be a Telegram unit test in a conformance-shaped wrapper,
which is the exact fiction constitution Principle IV exists to prevent.

Making the hook optional keeps the change additive for existing callers (Principle VII), while
failing loudly when an adapter declares `"mentions"` without supplying it keeps FR-012's "held to
the same contract" claim true rather than skippable. The Telegram adapter can satisfy the hook using
the stub transport and webhook handler it already has.

**Alternatives rejected**:
- Skip the mention checks when the hook is absent (the pattern the suite uses for `"thread"`) — for
  a capability an adapter *declared*, silent skipping means the contract is unenforced exactly where
  it matters. Skipping is right for probing what an adapter didn't declare, wrong here.
- Add a general inbound-emission method to `AccountAdapter` itself — pollutes the production contract
  with a testing affordance for every adapter forever.

## 7. Malformed entity payloads must not drop the message

**Decision**: Skip individual entities whose offset/length falls outside the text or is otherwise
inconsistent; surface via the existing non-fatal error channel; always still dispatch the message.

**Rationale**: FR-015. The adapter already has `reportNonFatalError` for inbound mapping problems,
and the webhook handler already treats mapping failures as non-fatal — mentions are metadata, and
losing a user's actual message because one entity was malformed trades a small degradation for a
large one. A bounds check also protects the slice: a bogus offset would otherwise yield a truncated
or empty `text` that silently violates SC-003's invariant.

**Alternatives rejected**:
- Throw and drop the update — disproportionate; loses real message content over metadata.
- Clamp offsets into range — produces a plausible-looking mention whose text is wrong, which is
  worse than omitting it.
