# @chatter/core

Normalized types, the `AccountAdapter` contract, the `Chatter` orchestrator, typed errors, and
delivery results for [Chatter](../../README.md) — a transport-only library for receiving and
sending messages across messaging platforms without provider-specific logic in your application.

This package has no provider SDKs and makes no network calls itself. It only defines the shared
contract every provider adapter (starting with `@chatter/testing`'s fake adapter, and later real
adapters like Telegram) implements.

## Install

```bash
pnpm add @chatter/core
```

## Minimal example

```ts
import { Chatter } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

const chatter = new Chatter({
  accounts: [{ accountName: "support-bot", adapter: new FakeAccountAdapter() }],
});

chatter.on("message.created", async (event) => {
  await chatter.send({
    account: event.account,
    conversation: event.message.conversation,
    text: `echo: ${event.message.text}`,
    replyToMessageId: event.message.id,
  });
});

await chatter.start();
```

See `specs/001-core-foundation/quickstart.md` in the repo root for a fuller walkthrough, and
`specs/001-core-foundation/contracts/core-api.md` for the full public API contract.

## Attachments

`Message.text`/`SendInput.text` are optional — a message can be text-only, attachment-only, or
both. An `Attachment` (`kind: "image" | "video" | "file"`, plus optional `fileName`/`mimeType`/
`sizeBytes`) is referenced either by a `{ url }` (inbound is always this; outbound may reference
existing remote content) or, for outbound sends, `{ data: Buffer }` for directly-supplied local
content. `SendInput.attachment` accepts at most one attachment per call. An account adapter must
declare the `"attachments"` capability to accept one — sending an attachment against an adapter
that doesn't declare it rejects with `ChatterUnsupportedCapabilityError`. See
`specs/004-attachment-model/quickstart.md` for worked examples, including the oversized-attachment
rejection path (`ChatterConfigurationError`).

## Message edits and deletions

Three capabilities, declared independently, because a provider may offer any combination —
being told about someone else's edit and being allowed to edit are unrelated permissions.

| Capability | Direction | Means |
|---|---|---|
| `"editNotifications"` | inbound | The adapter dispatches `"message.edited"` when a message it can observe changes. |
| `"editMessage"` | outbound | `chatter.editMessage()` works on this account. |
| `"deleteMessage"` | outbound | `chatter.deleteMessage()` works on this account. |

### Receiving edits

An edit arrives as its **own event**, never as another `"message.created"`:

```ts
chatter.on("message.edited", (event) => {
  store.replace(event.message.id, event.message); // same id as the original delivery
});
```

This is deliberate and load-bearing. Applications written before edits existed append or act on
whatever arrives through `"message.created"`; delivering edits there would make every one of
them double-handle, with nothing in the payload to tell the cases apart. **Subscribing to
nothing new changes nothing** — an application that registers no `"message.edited"` handler
behaves exactly as it did before.

`Message.createdAt` remains the **original** send time and is never overwritten.
`Message.editedAt` appears only once a message has been edited, and the key is **absent
entirely** otherwise — so `"editedAt" in message` is the test, and an unedited message keeps
byte-identical shape to before this feature.

An edit carries **no previous content**, and never will. Supplying it would mean Chatter
remembering every message it has delivered, which the constitution forbids twice over (no
message history, no content persistence by default). What a message said before is the
application's to keep if it needs it.

An edit for a message the application never received is still dispatched — it is not required
to hold prior state to make sense of one.

### Editing and deleting

```ts
await chatter.editMessage({ account: "bot", conversation, messageId, text: "corrected" });
await chatter.deleteMessage({ account: "bot", conversation, messageId });
```

Both resolve to a `DeliveryResult` naming the message acted on, the same shape `send()`
returns. Both reject with `ChatterUnsupportedCapabilityError` — **before any provider request
is made** — when the account does not declare the matching capability.

Chatter does not restrict either operation to messages the account itself sent. It forwards the
request and reports the provider's answer, because deciding who may change which message is the
provider's authorization model; reimplementing it locally would duplicate it and then drift
from it.

**An edit to content the message already has is a failure, not a no-op.** It rejects with
`ChatterConfigurationError` — the same category raised for over-length text and oversized
attachments, since all three are caller-supplied input the provider will reject. Reporting
success would present a refused request as carried out, and would hide an application whose
edit "succeeds" every time because it keeps recomputing the same content. An application that
edits on a timer will meet this routinely:

```ts
try {
  await chatter.editMessage({ account, conversation, messageId, text: status });
} catch (error) {
  if (!(error instanceof ChatterConfigurationError)) throw error;
  // Nothing to change — the message already says this.
}
```

### There is no notification when a message is deleted

**This is a provider limitation, not unfinished work.** Telegram's Bot API sends bots no update
of any kind when a message is deleted, so no adapter could honestly declare such a capability —
and application code would end up branching on something permanently false. There is
deliberately no `"deleteNotifications"` beside `"editNotifications"` in the `Capability` union,
and Chatter does not approximate one by polling, re-fetching conversations, or diffing snapshots
of conversation state.

Being able to *delete* a message and being *told* when someone else deletes one are different
things. Chatter offers the first and not the second.

## Mentions

Inbound messages from an adapter declaring the `"mentions"` capability carry
`Message.mentions` — an ordered list of the people referenced in `Message.text`. Each `Mention`
has the literal `text` as it appears, an `offset`/`length` locating it, an optional
`participant`, and a required `isSelf`.

**Offsets are UTF-16 code units**, which is exactly what JavaScript string indexing uses, so:

```ts
message.text.slice(mention.offset, mention.offset + mention.length) === mention.text; // always
```

Do **not** reach for `[...text]` or `Array.from(text)` to "handle Unicode properly" — those index
by *code point*, not code unit, and will shift every mention that follows an emoji or other
astral-plane character. In `"👋 @alice"` the mention starts at offset 3, not 2.

`participant` is present only when the provider identifies the person. A plain `@handle` mention
usually carries no participant, because most providers attach no user id to that form — a handle
can be renamed or transferred, so deriving an id from it would mint an identifier that silently
reassigns itself to a different person later. Check for its presence rather than assuming it:

```ts
for (const mention of message.mentions ?? []) {
  if (mention.isSelf) respondToBeingAddressed();
  if (mention.participant) recordReference(mention.participant);
}
```

`isSelf` lets an application act only when addressed without comparing any handle text itself.
A message that references no one omits `mentions` entirely rather than carrying an empty array,
so `message.mentions ?? []` is the idiomatic read.

## Testing this package

Test files that need `Chatter` or the typed errors must import them via the package name
(`"@chatter/core"`), not a relative path into `src/`. `@chatter/testing`'s `FakeAccountAdapter`
imports these classes via the package name too — importing via a relative path instead gives you
a second, distinct module instance of the same class, and `instanceof` checks between the two
will silently fail even though the code is identical.
