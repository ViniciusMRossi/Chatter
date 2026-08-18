# Quickstart: Validating Telegram Attachment Mapping

Prerequisites: pnpm installed and workspace dependencies installed (`pnpm install` from repo
root). No network access, credentials, or real Telegram bot required — everything here runs
against the existing `StubTelegramTransport` test harness, extended by this ticket.

## 1. Install and build

```bash
pnpm install
pnpm -r build
```

## 2. Run the automated test suite (primary validation)

```bash
pnpm -r test
```

Expected: all existing `@chatter/telegram` tests continue to pass unmodified (SC-005), plus new
coverage for inbound media dispatch, outbound attachment sends, the size-limit rejection, and the
now-fully-exercised conformance suite.

## 3. Receiving a photo with a caption (Story 1)

Deliver a synthetic webhook update via the webhook handler, same pattern as the existing
direct-chat integration test, but with a `photo` array and a `caption` instead of `text`:

```ts
const update = {
  update_id: 1,
  message: {
    message_id: 10,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 555, type: "private", first_name: "Ada" },
    from: { id: 777, is_bot: false, first_name: "Ada" },
    photo: [
      { file_id: "small", file_unique_id: "small-u", width: 90, height: 90 },
      { file_id: "large", file_unique_id: "large-u", width: 800, height: 800 },
    ],
    caption: "check this out",
  },
};
// POST this through createTelegramWebhookHandler(adapter), with StubTelegramTransport's
// getFile queued to resolve "large" (not "small") to a file_path.

// Expected: dispatched message has attachments: [{ kind: "image", source: { url: <resolved> } }],
// text: "check this out".
```

## 4. Receiving a document with no caption (Story 1)

Same shape, but `document: { file_id, file_unique_id, file_name, mime_type }` and no `caption`
field at all.

Expected: dispatched message has `attachments: [{ kind: "file", ... }]` and `text: undefined`.

## 5. Sending an attachment (Story 2)

```ts
import { Api } from "grammy";
import { TelegramAccountAdapter } from "@chatter/telegram";

// Using StubTelegramTransport in place of a real Api instance, as in every existing test:
await adapter.send({
  conversation: knownConversation,
  attachment: { kind: "image", source: { url: "https://example.com/cat.png" } },
});
// Expected: stub.calls contains one entry, method "sendPhoto", payload.photo === the URL.

await adapter.send({
  conversation: knownConversation,
  text: "here's the file",
  attachment: { kind: "file", source: { data: Buffer.from("hello") }, fileName: "hello.txt" },
});
// Expected: stub.calls contains one entry, method "sendDocument", payload.caption === "here's the file".
```

## 6. Oversized attachment rejection (Story 3)

```ts
import { ChatterConfigurationError } from "@chatter/core";

await expect(
  adapter.send({
    conversation: knownConversation,
    attachment: { kind: "image", source: { data: Buffer.alloc(10_000_001) } }, // 1 byte over 10MB
  }),
).rejects.toBeInstanceOf(ChatterConfigurationError);
// Expected also: stub.calls recorded zero new entries for this attempt.
```

## 7. Capability declaration (Story 2, Scenario 4)

```ts
expect(adapter.getCapabilities().has("attachments")).toBe(true);
```

## 8. Conformance suite (Story 5)

```bash
pnpm --filter @chatter/telegram test -- conformance
```

Expected: the suite's "send() with an attachment succeeds when 'attachments' is declared" check
(a no-op before this ticket, since this adapter didn't declare the capability) now runs and
passes against the stubbed transport.

## 9. Manual verification (Story 6)

Follow the new section in `packages/telegram/MANUAL-VERIFICATION.md` against a real bot — send
and receive an actual image, confirm it displays correctly, and confirm the resolved download URL
is treated as sensitive per the checklist's own reminder (FR-012). This step requires a human
with live Telegram credentials; it cannot be performed by an automated agent in this environment.
