# Contract: Inbound Events

**Feature**: 007-message-edits-deletions | **Surface**: `@chatter/core` adapter boundary + public
event API

Binding on every adapter, not only Telegram. A future adapter satisfies this or fails the shared
conformance suite.

---

## C1 — Adapter dispatch envelope

```ts
start(dispatch: (event: InboundEvent) => void): Promise<void>
```

An adapter MUST tag everything it dispatches:

```ts
dispatch({ kind: "message.created", message });   // a message arrived
dispatch({ kind: "message.edited",  message });   // a message it can observe changed
```

**MUST**
- Tag a changed message `"message.edited"`, never `"message.created"`.
- Dispatch `"message.edited"` **only** if it declares `"editNotifications"`.
- Carry the message's full content as of the edit — not a diff, not a description of the change.
- Reuse the identifier the message was first delivered under.

**MUST NOT**
- Carry the message's previous content in any field, under any name.
- Retain delivered messages in order to supply that content.
- Suppress an edit because it cannot find the original — an edit for an unseen message is
  dispatched like any other (FR-011).
- Coalesce consecutive edits of the same message.

**Breaking-change note**: this replaces `start(dispatch: (message: InboundMessage) => void)`. An
adapter written against the old signature will not compile. This is deliberate — see research D3
and the Complexity Tracking table in `plan.md`.

---

## C2 — Public event API

```ts
chatter.on("message.created", (event: MessageCreatedEvent) => { ... });
chatter.on("message.edited",  (event: MessageEditedEvent)  => { ... });
```

**The load-bearing invariant (FR-002)**: an edit MUST NOT reach a `"message.created"` handler.

This is the one rule in the feature with real blast radius. Every application written before this
feature appends or acts on whatever arrives through `"message.created"`. Routing edits there would
make all of them double-handle — appending a duplicate, re-running a side effect — with nothing in
the payload to tell the two apart. A separate event type is ignored by default by every existing
consumer, which is what makes this feature additive rather than breaking for applications.

The corresponding guarantee to consumers: **subscribing to nothing new changes nothing.** An
application that does not register a `"message.edited"` handler behaves exactly as it did before.

### Correlation

An application that wants to update what it showed correlates on `message.id`:

```ts
chatter.on("message.edited", (event) => {
  store.replace(event.message.id, event.message);   // same id as the original delivery
});
```

Chatter deliberately does not do this correlation itself — that would require holding the messages
it has delivered, which Principle I (no message history) and Principle VI (no content persistence)
both forbid.

---

## C3 — Timestamps

| Field | Meaning | On an edit |
|---|---|---|
| `createdAt` | when the message was originally sent | **unchanged** — never overwritten |
| `editedAt` | when it was last edited | present |

A message that has never been edited MUST omit `editedAt` entirely — not `undefined`, not `null`,
not epoch zero. A consumer must be able to write `if ("editedAt" in message)` and `Object.keys()`
must not gain a member. This is what SC-002 (an unchanged application behaves identically) rests
on.

---

## C4 — Mentions on edited content

An adapter declaring both `"mentions"` and `"editNotifications"` MUST report the mentions present
in the **edited** content, including reporting none when an edit removed the only one (FR-008).

The 006 rules carry over unchanged and are not relaxed for edits:
- Offsets are UTF-16 code units, indexing into the edited `text`.
- `text.slice(offset, offset + length) === mention.text` still holds.
- The entity array MUST be chosen by the same branch that chose text-vs-caption.

---

## C5 — Duplicate delivery

A provider redelivering the same update (for example after a lost acknowledgement) MUST NOT produce
a second `"message.edited"` dispatch (FR-009).

For Telegram this already holds: dedup is keyed on `update_id` and runs before any update-type
branching. It is nonetheless a required **test** — the property currently holds by an ordering
accident, and a refactor moving the dedup check inside the message branch would break it silently
(research D7).

---

## C6 — Deletions are not reported

There is no inbound deletion event and no capability that could declare one (FR-012).

**This is a provider limitation, not unfinished work.** Telegram's Bot API sends bots no
notification of any kind when a message is deleted. A capability no adapter could honestly declare
is worse than none, because application code would branch on something permanently false.

An adapter MUST NOT approximate one by polling, re-fetching conversations, or diffing snapshots of
conversation state (FR-013).

If a future provider *does* report deletions, the correct change is a new capability plus a new
`InboundEvent` member — which is exactly the extension the tagged envelope in C1 exists to make
cheap.

---

## Conformance checks derived from this contract

| Check | Requirement |
|---|---|
| An edit dispatches as `"message.edited"`, and no `"message.created"` handler observes it | FR-002, FR-025 |
| The edited message's `id` equals the original's | FR-003, FR-025 |
| `createdAt` is unchanged between create and edit; `editedAt` present only on the edit | FR-006, FR-025 |
| A never-edited message has no `editedAt` key | FR-007, FR-025 |
| An adapter declaring `"editNotifications"` without an `emitInbound` supporting `"edit"` fails loudly | FR-024 |
| Mentions on an edit reflect edited content | FR-008, C4 |
