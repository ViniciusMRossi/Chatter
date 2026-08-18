---
description: "Task list for Telegram Adapter Hardening (003)"
---

# Tasks: Telegram Adapter Hardening

**Input**: Design documents from `/specs/003-telegram-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hardening-additions.md, quickstart.md

**Tests**: Included — constitution Principle IV requires this, and spec.md's success criteria
are only verifiable through tests.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)

## Path Conventions

All changes are within the existing `packages/telegram/` package from ticket #2 — no new
package this ticket.

---

## Phase 1: Foundational (Blocking Prerequisite for US1)

**Purpose**: The bounded dedup primitive User Story 1 depends on. Other stories (US2-US5) don't
depend on this phase and could technically start in parallel, but are sequenced after it here
for a single linear implementation pass.

- [X] T001 [P] Implement `UpdateDedupWindow` (bounded `Map`-based FIFO set, capacity 1000,
      `has(updateId)`/`record(updateId)`) in
      `packages/telegram/src/dedup/update-dedup-window.ts`, per data-model.md.
- [X] T002 [P] Write unit tests for `UpdateDedupWindow`: membership after `record()`, no-op on
      re-recording an existing ID, oldest entry evicted once capacity is exceeded, in
      `packages/telegram/tests/unit/update-dedup-window.spec.ts`.

**Checkpoint**: The dedup primitive is implemented and independently tested.

---

## Phase 2: User Story 1 - A redelivered webhook update isn't processed twice (Priority: P1) 🎯 MVP

**Goal**: Delivering the same `update_id` twice results in exactly one dispatched inbound
message; a genuinely new `update_id` is never wrongly rejected.

**Independent Test**: POST an identical synthetic `Update` through the webhook handler twice;
assert the application handler fires exactly once.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Write failing integration test: the same `update_id` delivered twice via
      the webhook handler results in exactly one dispatched inbound message (second delivery
      still returns HTTP 200), in `packages/telegram/tests/integration/duplicate-delivery.spec.ts`.
- [X] T004 [P] [US1] Write failing test (same file): a distinct, unseen `update_id` delivered
      after several prior distinct updates is still dispatched normally.

### Implementation for User Story 1

- [X] T005 [US1] Add `hasProcessedUpdate(updateId)` / `recordProcessedUpdate(updateId)` to
      `TelegramAccountAdapter`, backed by a `UpdateDedupWindow` instance, in
      `packages/telegram/src/adapter/telegram-account-adapter.ts`. Depends on: T001.
- [X] T006 [US1] Wire `createTelegramWebhookHandler()` to check `hasProcessedUpdate()` before
      dispatch and call `recordProcessedUpdate()` after a successful dispatch — always
      returning HTTP 200 either way (Telegram must not be told to retry) — in
      `packages/telegram/src/webhook/telegram-webhook-handler.ts`. Depends on: T005.
- [X] T007 [US1] Run `pnpm -r test` and confirm T003 and T004 now pass.

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP for
this ticket.

---

## Phase 3: User Story 2 - A send failure reveals a chat's new ID after group migration (Priority: P2)

**Goal**: A migration-signaled send failure surfaces the new chat ID; a non-migration failure
never fabricates one.

**Independent Test**: Simulate a send failure whose response indicates chat migration and
confirm the new chat ID is discoverable from the resulting failure.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Write failing unit test: a synthetic `GrammyError` with
      `parameters.migrate_to_chat_id` set maps to a `ChatterInvalidTargetError` whose message
      contains the new chat ID, in `packages/telegram/tests/unit/errors.spec.ts`.
- [X] T009 [P] [US2] Write failing unit test (same file): a failure with no migration signal
      produces an error message that never mentions migration or a chat ID substitution.

### Implementation for User Story 2

- [X] T010 [US2] Extend `mapTelegramError` to check `error.parameters?.migrate_to_chat_id` and
      include it in the `ChatterInvalidTargetError` message per research.md's wording, in
      `packages/telegram/src/errors/map-telegram-error.ts`. Run `pnpm -r test` and confirm T008
      and T009 pass.

**Checkpoint**: User Stories 1-2 both independently functional.

---

## Phase 4: User Story 3 - An oversized outbound message fails immediately (Priority: P2)

**Goal**: Text over Telegram's 4096-character limit is rejected before any network call; text
at or under the limit is unaffected.

**Independent Test**: Attempt to send text exceeding the limit and confirm no outbound call is
recorded by the stub transport.

### Tests for User Story 3 ⚠️

- [X] T011 [P] [US3] Write failing unit test: `send()` with text over 4096 characters rejects
      with `ChatterConfigurationError`, and the stub transport records zero calls, in
      `packages/telegram/tests/unit/send-validation.spec.ts`.
- [X] T012 [P] [US3] Write failing unit test (same file): `send()` with text at exactly 4096
      characters succeeds normally (the limit is inclusive).

### Implementation for User Story 3

- [X] T013 [US3] Add the length pre-validation to `TelegramAccountAdapter.send()`, before any
      API call, in `packages/telegram/src/adapter/telegram-account-adapter.ts`. Run
      `pnpm -r test` and confirm T011 and T012 pass.

**Checkpoint**: User Stories 1-3 all independently functional.

---

## Phase 5: User Story 4 - A failed shutdown cleanup step is no longer invisible (Priority: P3)

**Goal**: A `deleteWebhook` failure during `stop()` doesn't prevent `stop()` from resolving, and
is discoverable via an injectable callback, without ever including a secret.

**Independent Test**: Force the stub transport's `deleteWebhook` to fail; call `stop()` with an
injected callback and confirm both that `stop()` resolves and the callback fired.

### Tests for User Story 4 ⚠️

- [X] T014 [P] [US4] Write failing unit test: `stop()` with a queued `deleteWebhook` failure
      still resolves without throwing, and an injected `onNonFatalError` spy is called, in
      `packages/telegram/tests/unit/stop-cleanup.spec.ts`.
- [X] T015 [P] [US4] Write failing unit test (same file): the message passed to
      `onNonFatalError` never contains the adapter's configured bot token or webhook secret.

### Implementation for User Story 4

- [X] T016 [US4] Add `onNonFatalError?: (message: string) => void` to
      `TelegramAccountAdapterOptions` (default: `console.error`); on a `deleteWebhook` failure
      in `stop()`, route it through the existing `mapTelegramError` sanitization and call
      `onNonFatalError` with the mapped error's message, in
      `packages/telegram/src/adapter/telegram-account-adapter.ts`. Run `pnpm -r test` and
      confirm T014 and T015 pass.

**Checkpoint**: User Stories 1-4 all independently functional.

---

## Phase 6: User Story 5 - Confidence the adapter works against real Telegram servers (Priority: P3)

**Goal**: A documented checklist exists for a human to verify the adapter against a real bot.

**Independent Test**: A human follows the checklist against a real bot; every step passes or
produces an actionable failure.

### Implementation for User Story 5

- [X] T017 [US5] Write `packages/telegram/MANUAL-VERIFICATION.md`: a checklist covering webhook
      registration against Telegram's real servers, a direct-chat round trip, and a group-chat
      round trip, per FR-008 — reusing `example-apps/telegram-echo` from ticket #2 as the app
      under test.

**Checkpoint**: All five user stories complete — ticket is feature-complete pending Polish.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Update `packages/telegram/README.md`: document the dedup window's bound and
      non-durability, migration-ID surfacing, the 4096-character limit, the `onNonFatalError`
      option, and link to `MANUAL-VERIFICATION.md`.
- [ ] T019 [P] Re-run `@chatter/testing`'s `runAccountConformanceSuite` (via the existing,
      unmodified `packages/telegram/tests/conformance.spec.ts`) to confirm no regression (SC-005).
- [ ] T020 Run `pnpm -r typecheck && pnpm -r lint && pnpm -r test` locally to confirm CI will
      pass before opening the pull request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS User Story 1 only.
- **User Story 1 (Phase 2)**: Depends on Foundational. This is the MVP.
- **User Story 2 (Phase 3)**: No dependency on US1 or Foundational — touches only
  `map-telegram-error.ts`. Could be implemented in parallel with US1.
- **User Story 3 (Phase 4)**: No dependency on US1/US2 — touches only `send()`'s validation.
  Could be implemented in parallel with either.
- **User Story 4 (Phase 5)**: No dependency on US1/US2/US3 — touches only `stop()`. Could be
  implemented in parallel with any of the above.
- **User Story 5 (Phase 6)**: Documentation only; benefits from US1-US4 being complete (so the
  checklist reflects final behavior) but has no code dependency.
- **Polish (Phase 7)**: Depends on all five user stories being complete.

### Parallel Opportunities

- T001 and T002 (Phase 1) can run in parallel.
- User Stories 1-4 touch disjoint code paths (webhook dedup, error mapping, send validation,
  stop cleanup) and could be implemented in parallel by different people once Phase 1 is done —
  sequenced here for a single linear pass instead.
- Within each story, all `[P]` test tasks can be written in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Foundational) and Phase 2 (User Story 1).
2. **STOP and VALIDATE**: confirm duplicate webhook deliveries no longer double-dispatch.
3. This alone closes the highest-priority gap from the readiness assessment — the one most
   likely to cause a visibly wrong outcome in production.

### Incremental Delivery

1. Foundational → User Story 1 → validate → duplicate-delivery gap closed.
2. User Story 2 → validate → migration ID discoverable.
3. User Story 3 → validate → oversized messages fail fast.
4. User Story 4 → validate → shutdown cleanup failures are observable.
5. User Story 5 → the manual checklist exists for a human to actually run.
6. Polish → documentation and CI confirmation, then open the PR.
