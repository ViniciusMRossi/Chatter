# Data Model: Telegram Attachment Mapping

No new types are introduced in `@chatter/core` or `@chatter/telegram`'s public surface — this
ticket populates the existing `Attachment` type (from `specs/004-attachment-model`) with real
values derived from Telegram's Bot API shapes, and extends internal mapping/adapter logic.

## Telegram source shapes (input to mapping, internal only)

| Telegram type | Relevant fields | Used for |
|---|---|---|
| `PhotoSize` (element of `Message.photo: PhotoSize[]`) | `file_id`, `file_unique_id`, `width`, `height`, `file_size?` | Inbound image attachments — always the last (largest) element of the array. |
| `Video` (`Message.video`) | `file_id`, `file_unique_id`, `file_name?`, `mime_type?`, `file_size?` | Inbound video attachments. |
| `Document` (`Message.document`) | `file_id`, `file_unique_id`, `file_name?`, `mime_type?`, `file_size?` | Inbound file attachments. |
| `File` (return of `api.getFile(file_id)`) | `file_id`, `file_unique_id`, `file_size?`, `file_path?` | Resolves to the downloadable URL. `file_path` is optional in Telegram's own type (a `getFile` call could theoretically not return one) — treated as a mapping failure surfaced through the adapter's existing error path, not a new error type, if absent. |

None of `file_id`/`file_unique_id` ever reach the `Attachment` produced by mapping — internal-only,
consumed entirely within `mapping/attachment.ts`.

## `Attachment` field population (inbound)

| `Attachment` field | Populated from | Notes |
|---|---|---|
| `kind` | Fixed per source type: `PhotoSize`→`"image"`, `Video`→`"video"`, `Document`→`"file"` | Not derived from `mime_type` — Telegram's own message shape already tells us the kind unambiguously. |
| `source` | `{ url: <resolved via getFile> }` | Always the `{url}` variant for inbound — see research.md. |
| `fileName` | `Video.file_name` / `Document.file_name` when present; absent for `PhotoSize` (Telegram never supplies one) | Not fabricated when Telegram doesn't supply it (FR-002). |
| `mimeType` | `Video.mime_type` / `Document.mime_type` when present; absent for `PhotoSize` | Same. |
| `sizeBytes` | `file_size` from whichever of `PhotoSize`/`Video`/`Document` was mapped, when present | Telegram documents this as optional even though it's usually present. |

## `Message` field population (inbound, extended)

| `Message` field | Populated from |
|---|---|
| `attachments` | `[mappedAttachment]` when the update carries photo/video/document; absent for a text-only update (unchanged from before this ticket). |
| `text` | `message.caption` for a media message; `message.text` for a plain text message; absent when neither is present. |

Everything else on `Message` (`id`, `sender`, `conversation`, `createdAt`, `replyToMessageId`) is
unchanged — mapped exactly as it already is for text messages today.

## `SendInput.attachment` → outbound Telegram call (mapping, internal only)

| `Attachment.kind` | Telegram method | Media parameter |
|---|---|---|
| `"image"` | `sendPhoto` | `source.url` (string) or `new InputFile(source.data, fileName)` |
| `"video"` | `sendVideo` | Same pattern |
| `"file"` | `sendDocument` | Same pattern |

`caption` (from `input.text`) and `reply_parameters` (from `input.replyToMessageId`) are passed
identically to how `sendMessage` already passes them today — no new parameter-building logic
beyond selecting the method and the media argument.

## Size-limit table (internal constant, not a public type)

| `Attachment.kind` | Real Telegram send limit |
|---|---|
| `"image"` | 10,000,000 bytes (10 MB) |
| `"video"` | 50,000,000 bytes (50 MB) |
| `"file"` | 50,000,000 bytes (50 MB) |

Enforced only against `{data: Buffer}` sources, before any API call — see research.md.
