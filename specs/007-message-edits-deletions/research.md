# Phase 0 Research: Message Edits and Deletions

**Feature**: 007-message-edits-deletions | **Date**: 2026-08-22

Resolves every open question the spec deliberately left to planning, plus the unknowns surfaced
while reading the current code. Each decision records what was chosen, why, and what was rejected.

---

## D1 — Capability identifiers

**Decision**: three new `Capability` members — `"editNotifications"`, `"editMessage"`,
`"deleteMessage"`.

**Rationale**: FR-018 requires three independently declarable capabilities and the spec's
assumptions require inbound edit reporting and outbound editing to be named distinguishably enough
that an adapter cannot plausibly declare one while meaning the other.

`"editNotifications"` names what the adapter *reports*; `"editMessage"` and `"deleteMessage"` name
operations the application *calls*. The grammatical split does the disambiguating work: a noun
phrase about received events cannot be misread as a verb phrase about an ability.

The naming has a second, deliberate payoff. The absence of `"deleteNotifications"` — sitting right
next to `"editNotifications"` in the union — makes FR-012 visible at the type level. A reader
scanning the capability list sees the gap and its shape at once, rather than having to find the
documentation that explains it.

**Alternatives rejected**:

- `"edits"` (inbound) + `"editing"` (outbound). Two words differing by three letters, both bare,
  gating opposite directions. This is exactly the confusable pair the spec's assumption forbids.
- `"messageEdits"` + `"editing"` + `"deleting"`. Better, but the outbound pair reads as a state
  rather than an operation, and drops the `deleteNotifications`-shaped hole that makes FR-012
  self-evident.
- Folding both outbound operations into one `"messageManagement"` capability. Violates FR-018
  directly: a provider permitting editing but not deletion (or vice versa) could not describe
  itself truthfully.

**Style note**: the existing members (`"text"`, `"reply"`, `"thread"`, `"attachments"`,
`"mentions"`) are single lowercase words. These three are camelCase compounds. The departure is
accepted knowingly: these are compound concepts, and the single-word forms that would preserve the
existing style are precisely the confusable ones rejected above. Consistency of style loses to
unambiguity of meaning.

---

## D2 — Error category for an edit rejected as unchanged (FR-020)

**Decision**: `ChatterConfigurationError`. No new error class is introduced.

**Rationale**: Telegram answers an unchanged edit with HTTP 400 and the description
`Bad Request: message is not modified`. FR-020 forbids reporting it as target-unreachable or as
authorization, and the user's resolution of Question 1 chose surfacing over swallowing without
minting a tenth category.

`ChatterConfigurationError` is already the category this codebase uses for *caller-supplied input
the provider will reject*, not merely for startup misconfiguration. Two existing precedents in
`send()`: text exceeding Telegram's 4096-character limit, and an attachment exceeding its
per-kind size limit — both raised as `ChatterConfigurationError` before or in place of a provider
round trip. "You asked to change a message to the content it already has" is the same kind of
fact about the caller's input, and lands in the same category.

**Alternatives rejected**:

- A new `ChatterNoChangeError`. This was option C in the spec's Question 1 and was not chosen.
  Noted here because if this rejection ever proves too coarse to filter on, minting the class is
  the change to make — and it is additive, so it can be made later without breaking anyone.
- `ChatterUnknownError` (where unmatched Telegram 400s currently fall). Technically available, but
  it means "we don't have a category for this", which is untrue once this mapping is written down
  — and `ChatterUnknownError` is the bucket a developer checks *last*.
- `ChatterInvalidTargetError`. Forbidden by FR-020, and actively misleading: the target is valid
  and reachable.

**Consequence for the mapper**: `mapTelegramError` currently has no notion of which operation
produced the error, and `message is not modified` must not be reinterpreted when it arises from
some other call. The match is therefore scoped to the edit path rather than added to the global
pattern table — see D6.

---

## D3 — Generalizing inbound dispatch (FR-023)

**Decision**: change the adapter contract's dispatch callback from carrying a bare message to
carrying a tagged inbound event.

```
start(dispatch: (event: InboundEvent) => void): Promise<void>
```

where `InboundEvent` is a discriminated union over `"message.created"` and `"message.edited"`,
each carrying an `InboundMessage`.

**Rationale**: the current signature is `(message: InboundMessage) => void` — it can express
exactly one thing happening, so a second inbound kind has nowhere to go. FR-002 requires edits to
arrive as a distinct kind, and reactions will require a third. A tagged union absorbs each new kind
as a new member rather than a new parameter.

This also mirrors the public surface: `ChatterEvent` in core is *already* a discriminated union
(with `MessageCreatedEvent` as its only member today), and `Chatter`'s internal event map is keyed
by the same strings. The adapter boundary is the one place still flattened to a single shape.

**This is a breaking change to `AccountAdapter`.** Accepted, with a version bump — see the
Constitution Check in `plan.md` and the Complexity Tracking table.

**Alternatives rejected**:

- **A second optional callback**: `start(dispatch, onEdit?)`. Backward compatible, and rejected for
  exactly that reason — it is the shape that makes the problem permanent. Reactions would add a
  third parameter, edits-of-reactions a fourth. FR-023 exists to stop this pattern, and taking the
  compatible option here would be taking it in the one place the spec named.
- **Widening the parameter to `InboundMessage | InboundEvent`**, so existing adapters that pass a
  bare message keep compiling (method-parameter bivariance makes this typecheck). Genuinely
  non-breaking and genuinely too clever: it leaves two ways to say "a message was created", so
  every consumer must handle both forms forever, and the ambiguity outlives the migration it was
  meant to smooth.
- **Keeping dispatch as-is and marking edits with a flag on the message** (e.g. `isEdit: true`).
  Fails FR-002 as written — the edit would still travel through the created-message channel, and
  every existing consumer would still double-handle it, which is the specific harm FR-002 exists
  to prevent.

**Blast radius, measured**: `AccountAdapter` has exactly two implementations, both in this
repository (`TelegramAccountAdapter`, `FakeAccountAdapter`), plus the conformance suite and the
`Chatter` orchestrator. No published third-party adapter exists — all packages are at `0.1.0` and
depend on core via `workspace:*`.

---

## D4 — Conformance suite inbound emission (FR-023, FR-024)

**Decision**: replace the mention-specific `emitInboundWithMentions` hook with a single
scenario-parameterized hook.

```
readonly emitInbound?: (adapter: AccountAdapter, scenario: InboundScenario) => void | Promise<void>;
```

with `InboundScenario = "mentions" | "edit"`, and a capability→scenario table inside the suite
mapping `"mentions"` → `"mentions"` and `"editNotifications"` → `"edit"`.

**Rationale**: FR-023 asks for a mechanism that is not specific to any one inbound feature. A
single hook taking a scenario name satisfies that literally: adding reactions adds a member to
`InboundScenario` and a row to the table, not a new hook and not a new config field. 006's rule is
preserved verbatim (FR-024) — an adapter declaring a capability whose scenario the config does not
supply fails with an explicit message naming the missing scenario, rather than skipping.

**Alternatives rejected**:

- Adding `emitInboundWithEdit` alongside the existing hook. This is the third-bespoke-hook outcome
  FR-023 was written to prevent.
- A fully generic `emitInbound(adapter)` with no scenario, leaving the suite to infer what it got.
  Rejected: the suite would have to guess whether an absent edit means "adapter is broken" or
  "adapter chose not to emit one", which is precisely the silent-skip failure mode FR-024 forbids.

**Migration note**: this renames a public export of `@chatter/testing`. Only
`packages/telegram/tests/conformance.spec.ts` and `packages/testing/tests/conformance.spec.ts`
consume it, both in-repo.

---

## D5 — Which Telegram update types carry inbound edits

**Decision**: handle `update.edited_message` only. `update.edited_channel_post` is **out of scope**.

**Rationale**: the webhook handler today reads `update.message` and nothing else — `channel_post`
is not handled at all. Handling `edited_channel_post` would mean dispatching edit notifications for
messages Chatter never delivered in the first place, so an application would receive edits of
things it has never seen and could not correlate. That is incoherent, not merely incomplete.

Channel posts are a coherent feature on their own (inbound `channel_post` plus its edits) and
belong in their own ticket. Recorded here so the omission reads as a boundary rather than as
something missed.

**Note for that future ticket**: FR-011 already requires an edit for an unseen message to be
dispatched rather than dropped, so the model does not need to change to accommodate channel posts
later — only the handler.

---

## D6 — Choosing text vs caption when editing (FR-017)

**Decision**: attempt the text edit first; on Telegram's specific
`there is no text in the message to edit` rejection, retry as a caption edit. Do not ask the caller
to declare which, and do not guess from the request.

**Rationale**: FR-017 requires the choice to be made from what the message actually carries, "not
assumed". Chatter holds no record of the messages it has sent (FR-005 and constitution Principle
VI), and Telegram's Bot API offers bots no way to fetch a message by id. The provider's own answer
is therefore the *only* available source of truth about which field the message has.

Cost, accepted knowingly: editing a caption costs two API round trips instead of one. Editing text
— the common case — still costs one. Error-string matching is already the established pattern in
`mapTelegramError` (`chat not found`, `blocked|kicked`), so this introduces no new class of
fragility.

If the fallback also fails, the fallback's error is surfaced, not the first one — the second call
is the one that made the real attempt against the field the message actually has.

**Alternatives rejected**:

- **A caller-supplied `target: "text" | "caption"` discriminant.** Pushes onto every application
  a fact it may not have (the message may have been sent by a different process, or the
  application may simply not have retained it), and lets a wrong answer produce a confusing
  provider error instead of a correct edit. It also literally "assumes", which FR-017 forbids.
- **Remembering which messages were sent with attachments.** Requires retaining sent-message state,
  which Principle VI forbids and FR-005 has already ruled out for the inbound direction. Solving
  the same problem with the same forbidden mechanism in the other direction is not more acceptable.
- **Always calling `editMessageCaption` first.** Same round-trip cost, but pays it on the common
  case rather than the rare one.

---

## D7 — Duplicate suppression for edits (FR-009)

**Decision**: no new mechanism. The existing `UpdateDedupWindow` already satisfies FR-009.

**Rationale**: dedup is keyed on `update.update_id` and applied in the webhook handler *before* any
update-type branching. Telegram assigns a distinct `update_id` to every update including
`edited_message`, so a redelivered edit is suppressed by the code already in place. Verified by
reading `createTelegramWebhookHandler` — the `hasProcessedUpdate` check precedes the
`update.message` branch and is not scoped to it.

**Consequence for tasks**: this needs a *test* proving the property holds for edits, not an
implementation change. Worth an explicit test precisely because it works by accident of ordering —
a future refactor moving the dedup check inside the message branch would silently break it.

---

## D8 — Timestamps (FR-006, FR-007)

**Decision**: add `Message.editedAt?: Date`, sourced from Telegram's `edit_date`. `createdAt`
continues to come from `date` and is never overwritten.

**Rationale**: Telegram supplies both fields on an `edited_message`, so no inference is needed.
Omitting `editedAt` entirely (rather than emitting `undefined` explicitly or a null sentinel) when
the message has never been edited satisfies FR-007 and matches the discipline `mentions` already
established in 006 — a never-edited message keeps byte-identical shape to what it had before this
feature.

**Free consequence, worth naming**: because `mapMessage` recomputes mentions from the message it is
handed, and an `edited_message` carries its own `entities`/`caption_entities`, FR-008 (mentions
reflect edited content) is satisfied with no additional mapping code. The `entities` /
`caption_entities` lockstep rule that 006 established applies unchanged.

---

## D9 — Return shape of the outbound operations (FR-022)

**Decision**: both `editMessage` and `deleteMessage` return `AdapterDeliveryResult` (and therefore
`DeliveryResult` through the orchestrator), the same shape `send()` already returns.

**Rationale**: FR-022 requires an outcome identifying the message acted on, consistent with what
sending reports. Reusing the existing type gives that for free and keeps one result shape across
all three operations rather than three near-identical ones.

For a deletion the `providerMessageId` is the id of the message removed. `timestamp` is omitted:
Telegram's `deleteMessage` returns only `true`, and synthesizing a local timestamp would present a
guess as a provider fact.

**Alternative rejected**: returning `void` from `deleteMessage`. Simpler, but breaks FR-022 and
makes the three operations inconsistent for no gain — a caller writing generic retry or logging
around "an outbound operation" would need to special-case delete.

---

## D10 — Where the capability gate lives (FR-018)

**Decision**: gate in the `Chatter` orchestrator, before the adapter method is called; adapters
additionally declare the outbound methods as optional on `AccountAdapter`.

**Rationale**: FR-018 requires failure with `ChatterUnsupportedCapabilityError` *before* contacting
the provider. Checking in the orchestrator guarantees that for every adapter uniformly, rather than
relying on each adapter to remember. Optional methods on the interface mean an adapter that does
not declare the capability need not implement a throwing stub.

The orchestrator therefore raises `ChatterUnsupportedCapabilityError` in two cases: the capability
is not declared, or it is declared but the method is absent. The second is an adapter bug, and
FR-024's conformance check is what catches it before release — but the runtime guard means it
surfaces as a typed error rather than a `TypeError: not a function`.

**Precedent**: this mirrors how `send()` already handles the thread capability, except that the
existing check lives in the Telegram adapter. Moving the *new* gates to the orchestrator is a
deliberate improvement, not an inconsistency; the existing thread check stays where it is (out of
scope here).

---

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| Does dedup need extending for edits? | No — keyed on `update_id` before type branching (D7). |
| Can the adapter learn whether a message has text or a caption? | Only by asking the provider (D6). |
| Does core need a new error class? | No — `ChatterConfigurationError` fits by established precedent (D2). |
| How many `AccountAdapter` implementations break? | Two, both in-repo; nothing published (D3). |
| Does mention mapping need edit-specific work? | No — falls out of recomputing from the edited message (D8). |
| Are channel posts in scope? | No — inbound `channel_post` is itself unhandled (D5). |
