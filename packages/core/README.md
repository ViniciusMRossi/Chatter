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
