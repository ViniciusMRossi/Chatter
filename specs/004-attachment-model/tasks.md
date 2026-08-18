---
description: "Task list for Attachment Model in Core (004)"
---

# Tasks: Attachment Model in Core

**Input**: Design documents from `/specs/004-attachment-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/attachment-additions.md, quickstart.md

**Tests**: Included — constitution Principle IV requires this, and spec.md's success criteria
are only verifiable through tests.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)

## Path Conventions

Changes are within the existing `packages/core/` and `packages/testing/` packages from ticket
#1 — no new package this ticket. One mechanical, non-behavioral compile-fix lands in
`packages/telegram/` (see T003 and research.md).

---

## Phase 1: Foundational (Blocking Prerequisite for all user stories)

**Purpose**: The `Attachment` type and the `text`-optionality correction everything else in this
ticket builds on (see research.md's "text becomes optional" decision).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `AttachmentKind`, `AttachmentSource`, and `Attachment` in
      `packages/core/src/types/attachment.ts`, per data-model.md.
- [X] T002 [P] Add `"attachments"` to the `Capability` union in
      `packages/core/src/types/capability.ts`.
- [X] T003 Change `text: string` to `text?: string` on `Message` in
      `packages/core/src/types/message.ts`, and on `SendInput` in
      `packages/core/src/adapter/adapter.ts`; then fix the resulting compile break in
      `packages/telegram/src/adapter/telegram-account-adapter.ts` (the 4096-character length
      check on `input.text` must guard for `undefined` and skip the check when there's no text —
      no other change to that file; this is a mechanical fix, not attachment support in
      Telegram). Run `pnpm -r typecheck` and confirm the whole monorepo compiles again.
- [X] T004 Export `Attachment`, `AttachmentKind`, `AttachmentSource` from
      `packages/core/src/types/index.ts`. Depends on: T001.

**Checkpoint**: `Attachment` type exists and is exported; `Message`/`SendInput` can represent
attachment-only content; the monorepo type-checks cleanly.

---

## Phase 2: User Story 1 - A received message can carry an attachment (Priority: P1) 🎯 MVP

**Goal**: A `Message` can be constructed with attachments alongside or instead of text, and
round-trips through the fake adapter into an application's `message.created` handler intact.

**Independent Test**: Construct messages with text+attachment, attachment-only, and text-only,
and confirm each is valid; emit one via `FakeAccountAdapter.emitInbound` and confirm the handler
receives the attachments unchanged.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Write unit test: a `Message` literal can be constructed with both `text` and
      `attachments`, with `attachments` only (no `text`), and with `text` only (no
      `attachments`) — all three compile and hold the expected values, in
      `packages/core/tests/unit/attachment.spec.ts`.
- [X] T006 [P] [US1] Write unit test (same file): an `Attachment` is valid with only `kind` and
      `source` set — `fileName`/`mimeType`/`sizeBytes` all omitted (FR-002 edge case).
- [X] T007 [P] [US1] Write integration test: `FakeAccountAdapter.emitInbound()` with an
      attachment-only inbound message (no `text`) dispatches a `message.created` event whose
      `event.message.attachments` matches exactly, and whose `event.message.text` is
      `undefined`, in `packages/core/tests/integration/attachment-round-trip.spec.ts`.

### Implementation for User Story 1

- [X] T008 [US1] Add `attachments?: readonly Attachment[]` to `Message` in
      `packages/core/src/types/message.ts`. Depends on: T001, T003. Run `pnpm -r test` and
      confirm T005-T007 pass.

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP.

---

## Phase 3: User Story 2 - Sending with an attachment succeeds when supported (Priority: P1)

**Goal**: `chatter.send()` with a single attachment (remote-reference or directly-supplied)
succeeds against an account that declares `"attachments"`, returning a normal delivery result.

**Independent Test**: Using a `FakeAccountAdapter` configured with `"attachments"`, send a
message with a `{url}` attachment and separately one with a `{data}` attachment; confirm both
resolve with a delivery result.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] Write unit test: `FakeAccountAdapter.send()` with a `{ url }`-sourced
      attachment, on an adapter constructed with `capabilities: ["text", "attachments"]`,
      resolves with a delivery result of the same shape already returned for a text-only send,
      in `packages/testing/tests/fake-account.spec.ts`.
- [X] T010 [P] [US2] Write unit test (same file): the same adapter's `send()` with a
      `{ data: Buffer }`-sourced attachment (and no `maxAttachmentSizeBytes` configured) also
      resolves normally.
- [X] T011 [P] [US2] Write unit test (same file): `chatter.send({ attachment, ...})` (via a
      `Chatter` instance wrapping the fake adapter, not calling the adapter directly) actually
      forwards the attachment through to the adapter's recorded `sentMessages` entry — proving
      `Chatter.send()`'s forwarding fix (T013) is real, in
      `packages/core/tests/integration/attachment-round-trip.spec.ts`.

### Implementation for User Story 2

- [X] T012 [US2] Add `attachment?: Attachment` to `SendInput` in
      `packages/core/src/adapter/adapter.ts`. Depends on: T001, T003.
- [X] T013 [US2] Update `Chatter.send()` in `packages/core/src/orchestrator/chatter.ts` to
      forward `input.attachment` into the `SendInput` it builds for the adapter (conditional
      inclusion, matching the existing `replyToMessageId` pattern). Depends on: T012.
- [X] T014 [US2] Add `attachment?: Attachment` handling to `FakeAccountAdapter.send()` in
      `packages/testing/src/fake-account/fake-account-adapter.ts`: when present and
      `capabilities.has("attachments")`, accept it (no special handling needed beyond passing
      the existing checks — the delivery result shape is unaffected). Depends on: T012. Run
      `pnpm -r test` and confirm T009-T011 pass.

**Checkpoint**: User Stories 1-2 both independently functional — the send/receive MVP is
complete.

---

## Phase 4: User Story 3 - An unsupported account rejects clearly (Priority: P2)

**Goal**: A send with an attachment against an account that doesn't declare `"attachments"`
fails with `ChatterUnsupportedCapabilityError`, never silently as text-only or with a generic
error.

**Independent Test**: Send an attachment-carrying message against a `FakeAccountAdapter`
constructed without `"attachments"`; confirm the specific error type, and that no delivery
result/`sentMessages` entry was produced.

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] Write unit test: `FakeAccountAdapter.send()` with an attachment, on an
      adapter constructed with `capabilities: ["text"]` (no `"attachments"`), rejects with
      `ChatterUnsupportedCapabilityError`, and `sentMessages` remains empty afterward, in
      `packages/testing/tests/fake-account.spec.ts`.

### Implementation for User Story 3

- [X] T016 [US3] In `FakeAccountAdapter.send()`, reject with `ChatterUnsupportedCapabilityError`
      when `input.attachment` is present and `!this.#capabilities.has("attachments")`, checked
      before the existing conversation/reply checks (mirroring the existing `"reply"`/`"thread"`
      capability-check pattern immediately above it), in
      `packages/testing/src/fake-account/fake-account-adapter.ts`. Depends on: T012, T014. Run
      `pnpm -r test` and confirm T015 passes.

**Checkpoint**: User Stories 1-3 all independently functional.

---

## Phase 5: User Story 4 - An oversized attachment is rejected before anything is sent (Priority: P2)

**Goal**: A directly-supplied (`{data}`) attachment larger than a configured limit is rejected
with `ChatterConfigurationError` before any transmission-equivalent action; an attachment within
the limit, or with no configured limit at all, is unaffected.

**Independent Test**: Configure a `FakeAccountAdapter` with `maxAttachmentSizeBytes`, attempt a
send with an oversized `{data}` attachment, and confirm rejection with zero `sentMessages`
entries; confirm an attachment at or under the limit still succeeds.

### Tests for User Story 4 ⚠️

- [X] T017 [P] [US4] Write unit test: `FakeAccountAdapter` constructed with
      `maxAttachmentSizeBytes: 10`, `send()` with a `{ data: Buffer.alloc(11) }` attachment
      rejects with `ChatterConfigurationError`, and `sentMessages` remains empty, in
      `packages/testing/tests/fake-account.spec.ts`.
- [X] T018 [P] [US4] Write unit test (same file): the same adapter's `send()` with a
      `{ data: Buffer.alloc(10) }` attachment (exactly at the limit) succeeds normally (the
      limit is inclusive, matching ticket #3's precedent for the text-length limit).
- [X] T019 [P] [US4] Write unit test (same file): an adapter constructed with NO
      `maxAttachmentSizeBytes` performs no size check at all — a large `{data}` attachment
      succeeds (Edge Case: "no size check applies" without a known limit).

### Implementation for User Story 4

- [X] T020 [US4] Add `maxAttachmentSizeBytes?: number` to `FakeAccountAdapterConfig` and store it
      on the instance in `packages/testing/src/fake-account/fake-account-adapter.ts`. Depends
      on: T014.
- [X] T021 [US4] In `FakeAccountAdapter.send()`, when `input.attachment.source` has a `data`
      field and `maxAttachmentSizeBytes` is configured, reject with `ChatterConfigurationError`
      if `data.byteLength > maxAttachmentSizeBytes`, checked before the capability/conversation
      checks and before incrementing `#sentCounter` (FR-007: before any transmission-equivalent
      action), in the same file. Depends on: T020. Run `pnpm -r test` and confirm T017-T019 pass.

**Checkpoint**: User Stories 1-4 all independently functional.

---

## Phase 6: User Story 5 - The conformance suite proves this for any future adapter (Priority: P3)

**Goal**: `runAccountConformanceSuite` exercises both the supported and unsupported attachment
paths, reusable by the next ticket's real Telegram adapter without modification.

**Independent Test**: Run the suite against a `FakeAccountAdapter` configured with
`"attachments"` and, separately, one without; confirm both configurations are correctly
validated.

### Tests for User Story 5 ⚠️

- [X] T022 [US5] Update `packages/testing/tests/conformance.spec.ts`'s existing
      `runAccountConformanceSuite` call to supply the new required `getTestAttachment` config
      field (a small `{ kind: "file", source: { data: Buffer.from("test") } }`), and run it once
      against a `FakeAccountAdapter` configured WITH `"attachments"` and once against one
      WITHOUT — confirming (per SC-006) the suite behaves correctly in both cases, not just the
      configured-suite-passes case.

### Implementation for User Story 5

- [X] T023 [US5] Add `getTestAttachment: () => Attachment` to `ConformanceSuiteConfig` in
      `packages/testing/src/conformance/conformance-suite.ts`, and add two new conditional
      checks alongside the existing `"thread"`-capability checks: when
      `capabilities.has("attachments")`, assert a `getTestAttachment()`-carrying send succeeds
      with a delivery result of the same shape as a text-only send; when it does not, assert the
      same send rejects with `ChatterUnsupportedCapabilityError`. Depends on: T012, T016. Run
      `pnpm -r test` and confirm T022 passes and no existing conformance check regressed
      (SC-005).

**Checkpoint**: All five user stories complete — ticket is feature-complete pending Polish.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T024 [P] Update `packages/core/README.md` (or equivalent top-level docs) to document the
      `Attachment` type, the `"attachments"` capability, and the `text`-becomes-optional change
      on `Message`/`SendInput`.
- [X] T025 [P] Update `packages/testing/README.md` (if one exists) to document
      `maxAttachmentSizeBytes` and the new required `getTestAttachment` conformance-suite config
      field.
- [X] T026 Run `pnpm -r typecheck && pnpm -r lint && pnpm -r test` locally across the whole
      monorepo (including `packages/telegram` and `example-apps/telegram-echo`, to confirm the
      `text`-optional change didn't silently break anything beyond the one guarded line from
      T003) to confirm CI will pass before opening the pull request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS every user story.
- **User Story 1 (Phase 2)**: Depends on Foundational. This is the MVP (receiving).
- **User Story 2 (Phase 3)**: Depends on Foundational. Independent of US1's own tests, but both
  are P1 and naturally sequenced together as the send/receive round trip.
- **User Story 3 (Phase 4)**: Depends on US2's `FakeAccountAdapter.send()` attachment handling
  (T014) existing to extend.
- **User Story 4 (Phase 5)**: Depends on US2/US3's `FakeAccountAdapter.send()` work (T014, T016)
  — adds the size check into the same method.
- **User Story 5 (Phase 6)**: Depends on US2 (`SendInput.attachment`) and US3
  (unsupported-capability rejection) existing, to encode both as reusable conformance checks.
- **Polish (Phase 7)**: Depends on all five user stories being complete.

### Parallel Opportunities

- T001 and T002 (Phase 1) can run in parallel; T003 and T004 depend on T001.
- Within each user story, all `[P]`-marked test tasks can be written in parallel.
- T024 and T025 (Polish) can run in parallel.

---

## Implementation Strategy

### MVP First (User Stories 1-2 Only)

1. Complete Phase 1 (Foundational).
2. Complete Phase 2 (US1 — receiving) and Phase 3 (US2 — sending).
3. **STOP and VALIDATE**: confirm the send/receive round trip works end-to-end via
   `quickstart.md` steps 3-4.
4. This alone closes the two P1 stories — the foundational round trip everything else guards.

### Incremental Delivery

1. Foundational → US1 → US2 → validate → send/receive round trip works (MVP).
2. US3 → validate → unsupported accounts reject clearly, not silently.
3. US4 → validate → oversized attachments fail fast.
4. US5 → validate → the conformance suite itself proves all of the above, reusable by the next
   (Telegram) ticket.
5. Polish → documentation and full monorepo CI confirmation, then open the PR.
