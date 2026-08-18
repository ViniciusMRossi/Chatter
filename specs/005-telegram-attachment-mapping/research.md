# Phase 0 Research: Telegram Attachment Mapping

## Decision: Inbound mapping — resolving `file_id` to a downloadable URL

**Decision**: A new `mapping/attachment.ts` module exposes an async function that, given a
Telegram `PhotoSize | Video | Document` and the adapter's grammY `Api` client, calls
`api.getFile(file_id)` to obtain a `File` (`{ file_id, file_unique_id, file_size?, file_path? }`),
then builds the download URL as `https://api.telegram.org/file/bot${botToken}/${file_path}` —
Telegram's own documented format. This becomes the `Attachment.source.url`. `file_id` and
`file_unique_id` are never placed on the resulting `Attachment` — only the resolved URL and
whichever of `fileName`/`mimeType`/`sizeBytes` Telegram's own media object already supplied
(`file_name`/`mime_type` for documents; Telegram doesn't supply these for photos, so `fileName`/
`mimeType` are left absent for image attachments, matching FR-002's "don't fabricate values
Telegram didn't supply").

**Rationale**: Directly implements FR-002 and FR-003 (the ticket's core inbound requirement) and
matches the standalone-`Api`-client architecture already established in ticket #2 (no `Bot`/
`Composer` machinery). `getFile` is the only Bot API mechanism that turns a `file_id` into
something downloadable — there is no alternative.

**Alternatives considered**: Handing back a synthetic reference like `telegram:file_id/<id>` for
the application to resolve itself later, deferring the `getFile` call — rejected outright: this
would leak a provider-specific reference into the normalized model, a direct violation of FR-003
and constitution Principle I/II (core, and by extension anything built on top of it, must never
need provider-specific knowledge to use an `Attachment`).

## Decision: The resolved download URL embeds the bot token — documented, not hidden

**Decision**: No attempt is made to proxy, wrap, or otherwise hide the fact that Telegram's
download URL format is `https://api.telegram.org/file/bot<token>/<file_path>` — the token is
structurally part of the URL. This ticket instead (a) ensures the adapter itself never logs a
resolved URL at any level (extending the existing standard already applied to the raw bot token
and webhook secret), and (b) requires `README.md` to state plainly that a received attachment's
`source.url` must be handled as sensitive — not logged, not displayed in a debugging tool, not
forwarded to an untrusted third party — exactly as if it were the token itself, because
functionally, for roughly the next hour, it is (FR-012).

**Rationale**: There is no Bot API mechanism to obtain a downloadable URL for a `file_id` that
doesn't embed the token — proxying the download through the adapter itself (i.e., the adapter
fetches the bytes and hands back some other kind of reference) was considered and rejected: it
would require the adapter to buffer arbitrary-sized file content in memory or to stand up its own
temporary HTTP endpoint, both disproportionate to this ticket's scope and in tension with
Chatter's transport-only, no-default-persistence stance (constitution Principles I and VI) — the
existing `{data: Buffer}` outbound path already gives applications a way to move bytes through
Chatter directly when they actually need to; nothing about inbound attachments requires the same.
Documenting the real risk honestly is the correct scope for this ticket, not engineering it away.

## Decision: Photo resolution — always the largest `PhotoSize`

**Decision**: `update.message.photo` is `PhotoSize[]`, sorted by Telegram from smallest to
largest per its own documented convention; the mapping takes the last element
(`photo[photo.length - 1]`) rather than assuming a fixed index or re-sorting.

**Rationale**: Directly implements FR-003. Not re-sorting (e.g. via `.sort((a,b) => a.width -
b.width)`) avoids a spurious dependency on `width`/`height` semantics when Telegram's own API
already guarantees array order; taking the last element is simpler and matches the platform's
documented behavior exactly.

## Decision: Caption → `Message.text`, no separate caption concept

**Decision**: `message.caption` (present on photo/video/document messages) maps directly to
`Message.text`; a media message with `caption === undefined` results in `text` being absent —
identical handling to `message.text` for a plain text message, just reading a different source
field on the Telegram payload. `mapping/message.ts`'s existing `TelegramTextMessage` type
(`Message & { text: string }`) is generalized to accept a message carrying text OR any supported
media kind OR both.

**Rationale**: Directly implements FR-004, and matches specs/004-attachment-model's design that
core has exactly one `text` field regardless of whether an attachment accompanies it — introducing
a parallel "caption" concept anywhere in this pipeline would contradict that already-established
model for no benefit.

## Decision: Outbound send — kind-based method selection, `{url}` vs `{data}` handling

**Decision**: `TelegramAccountAdapter.send()`, when `input.attachment` is present, selects
`sendPhoto`/`sendVideo`/`sendDocument` by `attachment.kind` (`image`→`sendPhoto`,
`video`→`sendVideo`, `file`→`sendDocument`). The method's first positional media argument is
`attachment.source.url` directly when the source is `{url}` (grammY/Telegram accepts a plain
HTTPS URL string here — Telegram fetches it server-side, satisfying FR-006), or
`new InputFile(attachment.source.data, attachment.fileName)` when the source is `{data}` (a real
multipart upload). `caption` (from `input.text`, when present) and `reply_parameters` (from
`input.replyToMessageId`, when present) are passed via the same `other` parameter object already
used for `sendMessage`.

**Rationale**: Directly implements FR-005 and FR-006, and is the natural mapping of Chatter's
existing `AttachmentSource` union onto grammY's own `InputFile | string` parameter type for these
three methods — no adapter-side branching beyond "which of the two source shapes is this."

## Decision: The ticket #4 placeholder "text is required" guard is relaxed for attachment sends

**Decision**: `send()`'s existing `if (input.text === undefined) throw ChatterConfigurationError(...)`
guard (added in ticket #4 as a mechanical compile-fix, since Telegram didn't support
attachment-only sends yet) is now only reached when `input.attachment` is also absent — i.e., the
check becomes "if there's neither text nor an attachment, reject," rather than "text is always
required." An attachment-only send (no caption) is now a fully valid, successful path.

**Rationale**: This is exactly the gap ticket #4's own plan.md flagged as intentionally
provisional pending this ticket ("this adapter doesn't implement attachments yet ... text is
still required here for now"). Removing the placeholder without weakening it to "anything goes"
preserves the one genuinely-still-true case: a `send()` call with neither text nor an attachment
has nothing to transmit and should still fail clearly, not attempt a call to `sendMessage` with
`undefined` text.

## Decision: Size-limit check — real per-kind Telegram limits, `{data}`-only, before any call

**Decision**: A `TELEGRAM_ATTACHMENT_SIZE_LIMITS` map (`image: 10_000_000`, `video: 50_000_000`,
`file: 50_000_000`, matching Telegram's documented 10MB/50MB — see Assumptions in spec.md re:
these being real platform values, not invented ones) is checked against
`attachment.source.data.byteLength` when the source is `{data}`, before any API call, throwing
`ChatterConfigurationError` on violation. No check applies to a `{url}` source (its size isn't
knowable client-side; Telegram's own eventual rejection reaches the caller through the adapter's
existing `mapTelegramError` fallback, unchanged).

**Rationale**: Directly implements FR-007, mirroring the exact pattern (and precedent-setting
code) ticket #3 established for the text-length limit and ticket #4 established for the fake
adapter's own `maxAttachmentSizeBytes` check — same shape, real Telegram-specific numbers instead
of a configurable test value.

## Decision: `StubTelegramTransport` needs realistic defaults for four more methods

**Decision**: `tests/support/stub-transport.ts`'s `#defaultResponse` gains cases for `sendPhoto`,
`sendVideo`, `sendDocument` (each returning a `message_id`/`date`/`chat` shape analogous to the
existing `sendMessage` case, echoing back the relevant media field) and `getFile` (returning a
synthetic `{file_id, file_unique_id, file_size, file_path}` built from the requested `file_id` so
tests can assert the mapping used the right one, with `queue()`/`queueError()` still available to
override any of the four for a specific test case, exactly as the existing methods already work).

**Rationale**: Required test infrastructure — without this, code exercising `getFile` or the three
send methods against the stub gets `{ok: true, result: true}` back and immediately fails on
`result.message_id`/`result.file_path` being `undefined`. This is scoped as this ticket's own
work (not a pre-existing bug) since nothing before this ticket ever called these four methods.

## Decision: Conformance suite — a real `getTestAttachment` for `packages/telegram`

**Decision**: `packages/telegram/tests/conformance.spec.ts`'s `runAccountConformanceSuite` call
now constructs the adapter via the same stubbed-transport pattern already used for
`getKnownConversation`, and supplies `getTestAttachment: () => ({ kind: "file", source: { data:
Buffer.from("conformance attachment") } })` — a small, valid, directly-supplied attachment well
under any real limit.

**Rationale**: Directly implements FR-010 and User Story 5. Ticket #4 already added the
`getTestAttachment` field and the two conditional checks to the shared suite itself
(`packages/testing`) — this ticket's job is only to make the "supported" branch, previously a
no-op for this adapter (since it didn't declare `"attachments"`), actually exercise real
(stubbed) send behavior. No change to the shared suite itself.
