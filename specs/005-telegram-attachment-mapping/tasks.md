---
description: "Task list for Telegram Attachment Mapping (005)"
---

# Tasks: Telegram Attachment Mapping

**Input**: Design documents from `/specs/005-telegram-attachment-mapping/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/attachment-mapping-additions.md, quickstart.md

**Tests**: Included — constitution Principle IV requires this, and spec.md's success criteria
are only verifiable through tests.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)

## Path Conventions

All changes are within the existing `packages/telegram/` package from tickets #2/#3, plus
additions to the existing `bruno/telegram-adapter/` collection. No new package, no
`@chatter/core` changes.

---

## Phase 1: Foundational (Blocking Prerequisite for US1-US3, US5)

**Purpose**: `StubTelegramTransport` needs realistic responses for `sendPhoto`/`sendVideo`/
`sendDocument`/`getFile` before any test exercising real mapping/send logic can run against it.

**⚠️ CRITICAL**: No user story's automated tests can pass until this phase is complete.

- [X] T001 [P] Extend `StubTelegramTransport`'s `#defaultResponse` in
      `packages/telegram/tests/support/stub-transport.ts`: add realistic default cases for
      `sendPhoto`, `sendVideo`, `sendDocument` (each returning a `message_id`/`date`/`chat` shape
      analogous to the existing `sendMessage` case), and `getFile` (returning a synthetic
      `{ file_id, file_unique_id, file_size, file_path }` built from the requested `file_id`, so
      tests can assert the correct `file_id` was resolved). `queue()`/`queueError()` continue to
      work for all four, unchanged.
- [X] T002 [P] Write unit tests confirming the new stub defaults: a `sendPhoto`/`sendVideo`/
      `sendDocument` call without a queued override returns a well-formed result; a `getFile`
      call returns a `file_path` derived from the requested `file_id`, in
      `packages/telegram/tests/support/stub-transport.spec.ts`.

**Checkpoint**: Test infrastructure exists for every subsequent story to build on.

---

## Phase 2: User Story 1 - A developer receives Telegram media as a normalized attachment (Priority: P1) 🎯 MVP

**Goal**: An inbound photo, video, or document (with or without a caption) is dispatched as a
message carrying a correctly-kinded attachment with a real, resolved download URL.

**Independent Test**: Deliver synthetic webhook updates carrying each media kind (with and
without a caption) and confirm each dispatches a message with the correct attachment.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Write unit test: mapping a `PhotoSize` (via a queued `getFile` response)
      produces an `Attachment` with `kind: "image"` and `source.url` built from the resolved
      `file_path` — never containing the raw `file_id`, in
      `packages/telegram/tests/unit/mapping.spec.ts`.
- [X] T004 [P] [US1] Write unit test (same file): mapping a `Video` or `Document` produces the
      correct `kind` (`"video"`/`"file"`) and populates `fileName`/`mimeType`/`sizeBytes` only
      from fields Telegram actually supplied (photo mapping never fabricates a fileName/mimeType
      Telegram didn't provide).
- [X] T005 [P] [US1] Write unit test (same file): given a `photo` array with multiple
      `PhotoSize` entries, the mapped attachment resolves the `file_id` of the LAST (largest)
      entry, not the first.
- [X] T006 [US1] Write integration test: a synthetic webhook update carrying a photo with a
      caption dispatches a message with `attachments: [{kind: "image", ...}]` and
      `text: "<caption>"`; the same shape with no caption dispatches with `text: undefined`, in
      `packages/telegram/tests/integration/attachment-round-trip.spec.ts`.
- [X] T007 [P] [US1] Write integration test (same file): a synthetic webhook update carrying a
      video, and separately one carrying a document, each dispatch a message with the correct
      attachment kind.

### Implementation for User Story 1

- [X] T008 [US1] Create `mapAttachment(media, kind, api)` in
      `packages/telegram/src/mapping/attachment.ts`: calls `api.getFile(media.file_id)`, builds
      `https://api.telegram.org/file/bot<token>/<file_path>`, populates `fileName`/`mimeType`/
      `sizeBytes` from whichever fields are present on `media`. Depends on: T001.
- [X] T009 [US1] Extend `mapMessage` in `packages/telegram/src/mapping/message.ts` to accept a
      message carrying `photo`/`video`/`document` (selecting the largest `PhotoSize` when
      applicable), call `mapAttachment` to populate `Message.attachments`, and read `text` from
      `caption` when the message carries media (falling back to `text` otherwise). Depends on:
      T008. Run `pnpm -r test` and confirm T003-T005 pass.
- [X] T010 [US1] Extend the dispatch gate in
      `packages/telegram/src/webhook/telegram-webhook-handler.ts` to also fire when
      `message?.photo`, `message?.video`, or `message?.document` is present, not only
      `message?.text`. Depends on: T009. Run `pnpm -r test` and confirm T006-T007 pass.

**Checkpoint**: User Story 1 fully functional and independently testable — inbound half of the
MVP.

---

## Phase 3: User Story 2 - A developer sends a message with an attachment via Telegram (Priority: P1)

**Goal**: `send()` accepts a single attachment (remote reference or directly-supplied bytes),
with or without a caption, choosing the correct outbound Telegram call.

**Independent Test**: Send an attachment referencing remote content, and separately one with
directly-supplied bytes, each with and without a caption, and confirm each succeeds with the
correct outbound call recorded by the stub.

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Write unit test: `send()` with an `{url}`-sourced image attachment records a
      `sendPhoto` call on the stub with `photo` equal to the URL string (no bytes read), in
      `packages/telegram/tests/unit/send-attachment.spec.ts`.
- [X] T012 [P] [US2] Write unit test (same file): `send()` with a `{data: Buffer}`-sourced
      attachment records the correct `sendPhoto`/`sendVideo`/`sendDocument` call (by kind) with
      an `InputFile`-wrapped payload.
- [X] T013 [P] [US2] Write unit test (same file): `send()` with an attachment AND `text` records
      the outbound call with `caption` equal to that text; `send()` with an attachment and no
      text succeeds with no `caption` set (no longer rejected by the ticket #4 placeholder
      guard).
- [X] T014 [P] [US2] Write unit test (same file): `send()` with neither `text` nor `attachment`
      still rejects with `ChatterConfigurationError` (the placeholder guard's one remaining valid
      case).
- [X] T015 [P] [US2] Write unit test: `getCapabilities()` returns exactly
      `{"text", "reply", "attachments"}`, in `packages/telegram/tests/unit/capabilities.spec.ts`.

### Implementation for User Story 2

- [X] T016 [US2] In `TelegramAccountAdapter.send()`
      (`packages/telegram/src/adapter/telegram-account-adapter.ts`), replace the unconditional
      "reject any attachment" check with real handling: select `sendPhoto`/`sendVideo`/
      `sendDocument` by `attachment.kind`, pass `source.url` directly or wrap `source.data` in
      grammY's `InputFile` (with `fileName`), and pass `input.text` as `caption` when present.
      Depends on: T001.
- [X] T017 [US2] Narrow the existing "text is required" guard so it only fires when
      `input.attachment` is ALSO absent — an attachment-only send is now valid. Depends on: T016.
      Run `pnpm -r test` and confirm T011-T014 pass.
- [X] T018 [US2] Update `CAPABILITIES` in `telegram-account-adapter.ts` to
      `new Set(["text", "reply", "attachments"])`. Depends on: T016, T017. Run `pnpm -r test` and
      confirm T015 passes.
- [X] T019 [P] [US2] Add `bruno/telegram-adapter/telegram-bot-api/send-photo.yml`,
      `send-video.yml`, `send-document.yml` — real-Telegram, local-only requests mirroring the
      existing `send-message.yml` pattern, per the standing Bruno-documentation workflow rule.

**Checkpoint**: User Stories 1-2 both independently functional — the full send/receive MVP for
Telegram attachments is complete.

---

## Phase 4: User Story 3 - An attachment too large for Telegram to accept is rejected immediately (Priority: P2)

**Goal**: A directly-supplied attachment exceeding the real per-kind Telegram limit is rejected
before any outbound call; one within the limit, or referencing remote content, is unaffected.

**Independent Test**: Attempt to send oversized directly-supplied content and confirm rejection
with zero outbound calls recorded.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Write unit test: `send()` with a `{data}` image attachment one byte over
      10MB rejects with `ChatterConfigurationError`, and the stub records zero calls, in
      `packages/telegram/tests/unit/send-attachment.spec.ts`.
- [X] T021 [P] [US3] Write unit test (same file): the same at exactly 10MB succeeds (inclusive
      limit, matching ticket #3's precedent); a `{data}` video/document attachment is checked
      against 50MB the same way.
- [X] T022 [P] [US3] Write unit test (same file): a `{url}`-sourced attachment of any size
      (simulated via a very long URL string, since size isn't otherwise knowable) is never
      rejected by this client-side check.

### Implementation for User Story 3

- [X] T023 [US3] Add a `TELEGRAM_ATTACHMENT_SIZE_LIMITS` constant (image: 10_000_000, video/file:
      50_000_000) and a pre-call check in `send()` — reject with `ChatterConfigurationError`
      before any API call when the attachment's source is `{data}` and `data.byteLength` exceeds
      the limit for its kind, in `telegram-account-adapter.ts`. Depends on: T016. Run
      `pnpm -r test` and confirm T020-T022 pass.

**Checkpoint**: User Stories 1-3 all independently functional.

---

## Phase 5: User Story 4 - Telegram's real constraints are documented (Priority: P2)

**Goal**: `README.md` accurately documents the size limits, the 20MB `getFile` download cap, and
that a resolved download URL is both temporary and sensitive.

**Independent Test**: A developer reads the documentation and can correctly predict send-limit
and download-reference behavior without experimentation.

### Implementation for User Story 4

- [X] T024 [US4] Update `packages/telegram/README.md`: document the 10MB/50MB send-side limits
      (matching T023 exactly), the separate 20MB `getFile` download cap (noting it applies
      regardless of a file's original send-time size), that resolved download URLs expire after
      roughly an hour, and — per FR-012 — that a resolved download URL embeds the bot's own
      token and must be handled as sensitive, never logged or displayed carelessly. Update the
      "Supported capabilities" and "Known limitations" sections to reflect that attachments are
      now supported.

**Checkpoint**: User Stories 1-4 all independently functional and documented.

---

## Phase 6: User Story 5 - The shared conformance suite proves the full attachment contract (Priority: P3)

**Goal**: `runAccountConformanceSuite`'s attachment checks (added in ticket #4) now genuinely
exercise this adapter's send behavior via the stubbed transport, not a capability mismatch.

**Independent Test**: Run the conformance suite against this adapter and confirm the
previously-inapplicable "supported" attachment check now passes for real.

### Implementation for User Story 5

- [X] T025 [US5] Update `packages/telegram/tests/conformance.spec.ts`'s
      `runAccountConformanceSuite` call to supply
      `getTestAttachment: () => ({ kind: "file", source: { data: Buffer.from("conformance attachment") } })`
      (replacing the placeholder comment noting the check was previously a no-op). Depends on:
      T016, T018, T023. Run `pnpm -r test` and confirm every conformance check passes, including
      the now-genuinely-exercised attachment-supported path, with zero regression to any
      pre-existing check (SC-005).
- [X] T026 [P] Add `bruno/telegram-adapter/local-webhook/photo-message.yml`,
      `photo-message-no-caption.yml`, and `document-message.yml` — synthetic, CI-safe webhook
      delivery requests proving the dispatch gate fires for media updates, wired into the
      existing `test:bruno` run alongside the existing `local-webhook/` requests.

**Checkpoint**: All P1-P3 automated-verification stories complete.

---

## Phase 7: User Story 6 - Confidence the adapter works against real Telegram servers (Priority: P3)

**Goal**: A documented checklist exists for a human to verify sending and receiving a real image
against a real bot.

**Independent Test**: A human follows the checklist against a real bot; it either confirms
success or surfaces a specific, actionable problem.

### Implementation for User Story 6

- [X] T027 [US6] Add a new section to `packages/telegram/MANUAL-VERIFICATION.md`, following the
      existing direct-chat/group-chat pattern: send an image to the bot and confirm it's
      received and displayable; have the bot send an image back and confirm it arrives; a
      reminder (per FR-012) that the resolved download URL should not be pasted into logs, chat,
      or a browser bar shared with anyone else during this check.

**Checkpoint**: All six user stories complete — ticket is feature-complete pending Polish.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T028 Run `pnpm -r typecheck && pnpm -r lint && pnpm -r test` locally to confirm CI will
      pass before opening the pull request.
- [X] T029 Run `pnpm --filter @chatter/telegram test:bruno` locally to confirm the extended
      Bruno collection passes in the same CI-safe way as before.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS every automated test in every story.
- **User Story 1 (Phase 2)**: Depends on Foundational. Inbound half of the MVP.
- **User Story 2 (Phase 3)**: Depends on Foundational. Outbound half of the MVP — independent of
  US1's own files (mapping vs. adapter `send()`), but both P1 and naturally paired.
- **User Story 3 (Phase 4)**: Depends on US2's `send()` attachment handling (T016) existing to
  extend with the size check.
- **User Story 4 (Phase 5)**: Depends on US2/US3's real numbers (T018, T023) existing to document
  accurately.
- **User Story 5 (Phase 6)**: Depends on US1, US2, US3 all being complete (the conformance
  suite's supported-path check exercises real send behavior end-to-end).
- **User Story 6 (Phase 7)**: Documentation only; benefits from US1-US5 being complete but has no
  code dependency.
- **Polish (Phase 8)**: Depends on all six user stories being complete.

### Parallel Opportunities

- T001 and T002 (Phase 1) can run in parallel.
- Within each story, all `[P]`-marked test tasks can be written in parallel.
- User Stories 1 and 2 touch disjoint files (mapping/webhook-handler vs. adapter `send()`) and
  could be implemented in parallel by different people once Phase 1 is done — sequenced here for
  a single linear pass instead.

---

## Implementation Strategy

### MVP First (User Stories 1-2 Only)

1. Complete Phase 1 (Foundational).
2. Complete Phase 2 (US1 — receiving) and Phase 3 (US2 — sending).
3. **STOP and VALIDATE**: confirm the full attachment send/receive round trip works against the
   stubbed transport, per quickstart.md steps 3-7.
4. This alone closes both P1 stories — the foundational Telegram attachment round trip.

### Incremental Delivery

1. Foundational → US1 → US2 → validate → send/receive round trip works (MVP).
2. US3 → validate → oversized attachments fail fast.
3. US4 → validate → real constraints are documented accurately.
4. US5 → validate → the shared conformance suite proves the full contract for this adapter.
5. US6 → the manual checklist exists for a human to actually run against a real bot.
6. Polish → full monorepo CI confirmation (including Bruno), then open the PR.
