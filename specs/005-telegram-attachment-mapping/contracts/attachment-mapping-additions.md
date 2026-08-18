# Contract: `@chatter/telegram` additions (attachment mapping)

This is a diff against ticket #2's `specs/002-telegram-adapter/contracts/telegram-adapter-api.md`
and ticket #3's `specs/003-telegram-hardening/contracts/hardening-additions.md` — everything not
listed here is unchanged. As before, signatures are illustrative; naming refinements are allowed
as long as behavior matches. No `@chatter/core` contract changes — this ticket consumes
`specs/004-attachment-model`'s contract exactly as defined.

## `TelegramAccountAdapter.getCapabilities()` (behavior extended, signature unchanged)

Returns `{"text", "reply", "attachments"}` — was `{"text", "reply"}`.

## `TelegramAccountAdapter.send()` (behavior extended, signature unchanged)

- When `input.attachment` is present, MUST select `sendPhoto`/`sendVideo`/`sendDocument` based on
  `attachment.kind` (`"image"`/`"video"`/`"file"` respectively) instead of rejecting with
  `ChatterUnsupportedCapabilityError` (ticket #4's placeholder behavior is removed for this case).
- MUST pass `attachment.source.url` directly as the method's media parameter when the source is
  `{url}` — no bytes read or transmitted by the adapter itself.
- MUST wrap `attachment.source.data` in grammY's `InputFile` (with `attachment.fileName` when
  present) when the source is `{data}` — a genuine multipart upload.
- MUST reject with `ChatterConfigurationError`, before any API call, when `attachment.source` is
  `{data}` and `data.byteLength` exceeds the real Telegram limit for `attachment.kind` (10MB
  image, 50MB video/file — see data-model.md).
- MUST NOT apply the above size check to a `{url}`-sourced attachment.
- The previously-unconditional `if (input.text === undefined) throw ChatterConfigurationError(...)`
  check (from ticket #4) now only fires when `input.attachment` is ALSO absent — an
  attachment-only send (no caption) is a valid, successful call.
- `input.text`, when present alongside an attachment, MUST be passed as the outbound call's
  `caption` parameter.

## `mapping/attachment.ts` (new, internal — not part of the adapter's public contract)

```ts
async function mapAttachment(
  media: PhotoSize | Video | Document,
  kind: AttachmentKind,
  api: Api,
): Promise<Attachment>;
```

- MUST call `api.getFile(media.file_id)` and build the download URL as
  `https://api.telegram.org/file/bot<token>/<file_path>` — never expose `file_id` or
  `file_unique_id` on the returned `Attachment`.
- MUST populate `fileName`/`mimeType`/`sizeBytes` only from fields Telegram's own media object
  actually supplied — never fabricated.
- For `PhotoSize[]`, the caller (not this function) MUST select the last (largest) element before
  calling this function.

## `mapping/message.ts` (`mapMessage`, behavior extended)

- MUST now accept a Telegram message carrying `text`, or `photo`/`video`/`document` (with or
  without a `caption`), or both.
- `Message.attachments` MUST be populated (via `mapAttachment`) when the source message carries
  photo/video/document; absent otherwise (unchanged).
- `Message.text` MUST come from `caption` when the message carries media, or from `text`
  otherwise; absent when neither is present.

## `telegram-webhook-handler.ts` (behavior extended, signature unchanged)

Still `(request: Request) => Promise<Response>`. The dispatch gate (previously
`message?.text !== undefined`) now also fires when `message?.photo`, `message?.video`, or
`message?.document` is present — a media update with no caption and no text is no longer
silently dropped.

## `tests/support/stub-transport.ts` (test-only, extended)

`StubTelegramTransport`'s default responses gain realistic cases for `sendPhoto`, `sendVideo`,
`sendDocument` (message-shaped results, analogous to the existing `sendMessage` default) and
`getFile` (a synthetic `File` built from the requested `file_id`). `queue()`/`queueError()`
continue to work for all four, unchanged.

## `MANUAL-VERIFICATION.md` (extended)

New section covering sending and receiving a real image against a real Telegram bot — the one
part of this ticket that can't be automated without live credentials (User Story 6, FR-011).
