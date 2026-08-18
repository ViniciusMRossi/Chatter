# Implementation Plan: Telegram Attachment Mapping

**Branch**: `005-telegram-attachment-mapping` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-telegram-attachment-mapping/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Implements the provider side of `specs/004-attachment-model`'s contract in `@chatter/telegram`:
the webhook handler dispatches photo/video/document updates (not just text), mapping each into
an `Attachment` whose `source.url` is a real, resolved download URL obtained via grammY's
`getFile` — Telegram's own opaque `file_id`/`file_unique_id` never reach application code.
`TelegramAccountAdapter.send()` gains attachment handling, choosing `sendPhoto`/`sendVideo`/
`sendDocument` by kind and either passing a `{url}` through directly or wrapping `{data: Buffer}`
in grammY's `InputFile`. `getCapabilities()` now includes `"attachments"`. No change to
`@chatter/core` — purely additive within the existing `packages/telegram` package from tickets
#2/#3.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js active LTS — unchanged from tickets
#2/#3.

**Primary Dependencies**: None new. Still grammY's standalone `Api` client + `@grammyjs/types`
(v4.0.0), as established in ticket #2. Uses grammY's `InputFile` class (already part of the
`grammy` package) for outbound `{data: Buffer}` uploads — not a new dependency.

**Storage**: N/A — no new persistence. A resolved download URL is handed to the application and
not retained by the adapter itself, consistent with core's no-default-persistence stance
(constitution Principle VI) and this ticket's own Assumption that the adapter does not attempt
to keep references valid past Telegram's own ~1 hour window.

**Testing**: Vitest, against the existing `StubTelegramTransport` harness (`tests/support/
stub-transport.ts`) from ticket #2 — no real network calls. That harness's `#defaultResponse`
currently falls through to a generic `{ok: true, result: true}` for any method it doesn't
special-case (including `sendPhoto`/`sendVideo`/`sendDocument`/`getFile`), which is not a
realistic enough shape for this ticket's own code to consume (e.g. `result.message_id`,
`result.file_path`) — the harness needs targeted defaults/queueable responses for these four
methods before adapter code can be tested against it. This is scoped as this ticket's own
Phase 1 test-infrastructure work, not a pre-existing gap to route around.

**Target Platform**: Unchanged — Node.js server/library runtime.

**Project Type**: Library — all changes within the existing `packages/telegram` package; no new
package, no change to `@chatter/core`.

**Performance Goals**: Not a driver. `getFile` and the outbound send calls are already
network-bound API calls (same cost class as the existing `sendMessage`); the one new synchronous
check (directly-supplied attachment size vs. the real per-kind limit) is O(1), consistent with
core's NFR-006.

**Constraints**: No new `ChatterError` subclass (constitution Principle V — reuses
`ChatterConfigurationError` for the size check, exactly as ticket #3 did for the text-length
limit, and the existing `mapTelegramError` fallback for anything Telegram itself rejects). No
change to `@chatter/core` (constitution Principle II). The resolved inbound download URL embeds
the bot's own token (Telegram's own file-download mechanism, not something this ticket can avoid
— see research.md and spec.md FR-012) — this must be documented prominently, and the adapter
itself must never log a resolved download URL at any level, matching the existing standard
already applied to the bot token and webhook secret (constitution Principle VI).

**Scale/Scope**: Four modified existing files (`telegram-webhook-handler.ts`,
`telegram-account-adapter.ts`, `mapping/message.ts`, `tests/support/stub-transport.ts`), one new
mapping file (`mapping/attachment.ts`), plus Bruno collection additions and a
`MANUAL-VERIFICATION.md` extension. No new package.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does this interpret media content? | PASS — the adapter resolves a download reference and passes bytes/URLs through; nothing inspects, transcodes, or classifies actual file content (FR-002, out-of-scope list). |
| II. Adapter Isolation & Extensibility | Does this require modifying `@chatter/core`? | PASS — every change is internal to `packages/telegram`; consumes `Attachment`/`SendInput.attachment`/the `"attachments"` `Capability` exactly as ticket #4 already defined them. |
| III. Capabilities Over False Parity | Is attachment support declared accurately? | PASS — `getCapabilities()` gains `"attachments"` only once this ticket's send/receive behavior genuinely supports it (FR-008), matching the existing `"reply"`/`"thread"` precedent. |
| IV. Test-First, Contract-Tested | Tests before/alongside implementation? Conformance suite exercised, not bypassed? | PASS — tasks.md sequences stub-transport extensions and tests before the corresponding implementation; `conformance.spec.ts`'s previously-inapplicable "supported" attachment check now genuinely exercises this adapter (FR-010, User Story 5). |
| V. Typed, Explicit Contracts | New error type introduced? | PASS (by avoidance) — reuses `ChatterConfigurationError` (size limit) and the existing `mapTelegramError` fallback; no new error class. |
| VI. Security & Privacy By Default | Secrets/credentials ever logged or exposed unnecessarily? | Requires care, not a free pass — see research.md's "resolved URL contains the bot token" finding (FR-012). The adapter itself never logs a resolved URL; the requirement this ticket adds is that documentation makes the risk explicit to host applications, which are outside the adapter's control once the `Message` is handed off. |
| VII. Independent Semantic Versioning | Breaking change to `@chatter/telegram`'s public API? | PASS — `getCapabilities()`'s returned set gaining a value and `send()` accepting a previously-rejected input shape are both purely additive from a calling code's perspective; no existing call site breaks. |

No violations requiring a Complexity Tracking entry — the Principle VI note above is a
requirement this plan explicitly satisfies (documentation, never-log), not an exception granted
against the principle.

## Project Structure

### Documentation (this feature)

```text
specs/005-telegram-attachment-mapping/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/telegram/
├── src/
│   ├── mapping/
│   │   ├── attachment.ts             # NEW — Telegram photo/video/document → Attachment,
│   │   │                             #   including the getFile round trip
│   │   └── message.ts                # MODIFIED — accepts media messages (not just text-only),
│   │                                 #   populates Message.attachments, caption → text
│   ├── adapter/
│   │   └── telegram-account-adapter.ts  # MODIFIED — send() attachment handling
│   │                                     #   (sendPhoto/sendVideo/sendDocument selection,
│   │                                     #   {url} vs {data} via InputFile, size check),
│   │                                     #   getCapabilities() gains "attachments"
│   └── webhook/
│       └── telegram-webhook-handler.ts   # MODIFIED — dispatch gate also fires for
│                                         #   photo/video/document updates
├── tests/
│   ├── support/
│   │   └── stub-transport.ts             # MODIFIED — realistic default/queueable responses
│   │                                     #   for sendPhoto/sendVideo/sendDocument/getFile
│   ├── unit/
│   │   ├── mapping.spec.ts                # EXTENDED — photo/video/document → Attachment,
│   │   │                                 #   largest PhotoSize selection, caption → text
│   │   ├── send-validation.spec.ts        # EXTENDED — oversized {data} attachment rejection
│   │   └── capabilities.spec.ts           # EXTENDED — {"text","reply","attachments"}
│   ├── integration/
│   │   └── attachment-round-trip.spec.ts  # NEW — inbound dispatch + outbound send, both
│   │                                     #   {url} and {data}, with and without caption
│   └── conformance.spec.ts                # MODIFIED — supplies a real getTestAttachment,
│                                         #   constructs the adapter with attachment support
├── README.md                              # MODIFIED — size limits, 20MB download cap,
│                                         #   temporary + sensitive download URL
└── MANUAL-VERIFICATION.md                 # MODIFIED — new section for a real-bot image round trip

bruno/telegram-adapter/
├── telegram-bot-api/
│   ├── send-photo.yml                    # NEW — real-Telegram, local-only
│   ├── send-video.yml                    # NEW
│   └── send-document.yml                 # NEW
└── local-webhook/
    ├── photo-message.yml                 # NEW — synthetic, CI-safe
    ├── photo-message-no-caption.yml      # NEW
    └── document-message.yml              # NEW
```

**Structure Decision**: Everything stays inside the existing `packages/telegram` package
established in ticket #2 and hardened in ticket #3 — this ticket is a feature addition to that
one package, not a new component, mirroring ticket #3's own structure decision.

## Complexity Tracking

*No constitution violations — table not applicable.*
