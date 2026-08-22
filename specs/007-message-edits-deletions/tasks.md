---

description: "Task list for 007-message-edits-deletions"
---

# Tasks: Message Edits and Deletions

**Input**: Design documents from `/specs/007-message-edits-deletions/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **REQUIRED**, not optional. Constitution Principle IV mandates tests written before or
alongside implementation, and FR-023 – FR-027 are themselves test-suite requirements. Every story
below leads with its tests.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4, mapping to the user stories in spec.md
- Every task names an exact file path

## Path Conventions

pnpm monorepo. Three library packages, each with `src/` and `tests/`:
`packages/core`, `packages/telegram`, `packages/testing`. Executable API documentation lives in
`bruno/telegram-adapter/`.

---

## Phase 1: Setup

**Purpose**: Version the breaking change before anything depends on it.

- [X] T001 Bump `version` to `0.2.0` in `packages/core/package.json` — `AccountAdapter` changes shape (plan.md Complexity Tracking; 0.x semver puts a breaking change in a minor bump)
- [X] T002 [P] Bump `version` to `0.2.0` in `packages/telegram/package.json`
- [X] T003 [P] Bump `version` to `0.2.0` in `packages/testing/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core model and the adapter contract. Every story depends on this phase.

**⚠️ CRITICAL**: T007 is a breaking change. T007–T010 must land in a **single commit** so the
workspace never sits in a non-compiling state — the constitution requires small increments, not
broken ones.

### Core model (additive, no consumer changes)

- [X] T004 [P] Add `editedAt?: Date` to `Message` in `packages/core/src/types/message.ts`, documenting that it is omitted entirely when never edited and that `createdAt` is never overwritten (data-model.md §1)
- [X] T005 [P] Add `"editNotifications" | "editMessage" | "deleteMessage"` to `Capability` in `packages/core/src/types/capability.ts`, with a doc comment on each stating its direction and an explicit note that `"deleteNotifications"` does not exist because no provider reports deletions (FR-012, data-model.md §2)
- [X] T006 [P] Add `MessageEditedEvent` and widen `ChatterEvent` to a real union in `packages/core/src/types/event.ts` (data-model.md §4)

### Adapter contract (breaking — T007–T010 as one commit)

- [X] T007 Add `InboundEvent` and change `start()` to `start(dispatch: (event: InboundEvent) => void)` in `packages/core/src/adapter/adapter.ts`, with a comment recording why a tagged envelope was chosen over a second callback (research D3, contracts/inbound-events.md C1)
- [X] T008 Add `EditInput` and `DeleteInput`, and declare optional `editMessage?()` / `deleteMessage?()` on `AccountAdapter` in `packages/core/src/adapter/adapter.ts` (data-model.md §5, contracts/outbound-ops.md C7)
- [X] T009 Update `TelegramAccountAdapter` in `packages/telegram/src/adapter/telegram-account-adapter.ts` to the new dispatch signature — mechanical: `#dispatch` field type and `dispatchInbound()` wrap the message as `{ kind: "message.created", message }`
- [X] T010 Update `FakeAccountAdapter` in `packages/testing/src/fake-account/fake-account-adapter.ts` to the new dispatch signature, keeping `emitInbound()`'s public shape unchanged so existing callers are untouched
- [X] T011 Export `InboundEvent`, `EditInput`, `DeleteInput`, `MessageEditedEvent` from `packages/core/src/types/index.ts` and `packages/core/src/index.ts` as appropriate

### Orchestrator

- [X] T012 Route tagged inbound events in `Chatter.#dispatchInbound()` in `packages/core/src/orchestrator/chatter.ts` — `"message.created"` and `"message.edited"` dispatch to their own listener sets, filling `account` on the message inside the envelope
- [X] T013 Add `"message.edited": MessageEditedEvent` to the `ChatterEventMap` in `packages/core/src/orchestrator/chatter.ts` so `on()`/`off()` accept it with full typing

**Checkpoint**: `pnpm run typecheck` and all 158 existing tests pass. Nothing observable has changed
for any application yet — this is the load-bearing regression gate for SC-002.

---

## Phase 3: User Story 1 - A developer is told when a message they already received changed (Priority: P1) 🎯 MVP

**Goal**: An edited message reaches the application as its own event, correlatable by id, with
honest timestamps and edit-accurate mentions.

**Independent Test**: Feed the webhook handler a synthetic `message` update then an
`edited_message` update for the same `message_id`; confirm one `"message.created"` and one
`"message.edited"` dispatch, same id, `createdAt` unchanged, `editedAt` present only on the second.
No credentials involved.

### Tests for User Story 1 ⚠️ Write first, confirm they fail

- [X] T014 [P] [US1] Generalize the conformance hook in `packages/testing/src/conformance/conformance-suite.ts`: add `InboundScenario = "mentions" | "edit"`, replace `emitInboundWithMentions` with `emitInbound?(adapter, scenario)`, and drive the existing mention checks through it (FR-023, research D4)
- [X] T015 [US1] Add the capability→scenario requirement table to `packages/testing/src/conformance/conformance-suite.ts`, failing with an explicit message naming the missing scenario when a declared capability has no `emitInbound` — a failure, never a skip (FR-024)
- [X] T016 [US1] Add conformance checks for inbound edits in `packages/testing/src/conformance/conformance-suite.ts`: edit arrives as `"message.edited"`; **no `"message.created"` handler observes it**; id matches the original; `createdAt` unchanged; `editedAt` present on the edit and the key absent on the original (FR-025, contracts/inbound-events.md C3)
- [X] T017 [P] [US1] Update `packages/testing/tests/conformance.spec.ts` and `packages/telegram/tests/conformance.spec.ts` to the renamed `emitInbound` hook
- [X] T018 [P] [US1] Add integration tests in `packages/telegram/tests/integration/edit-round-trip.spec.ts` covering quickstart Scenarios 1–3: edit dispatches separately, timestamps stay honest, mentions follow edited content (including an emoji case and an edit that removes the only mention)
- [X] T019 [P] [US1] Add a redelivered-edit test to `packages/telegram/tests/integration/duplicate-delivery.spec.ts` — same `update_id` twice yields one dispatch and two `200`s (FR-009; research D7 explains why this needs a test despite already working)

### Implementation for User Story 1

- [X] T020 [US1] Add `emitInboundEdit()` to `FakeAccountAdapter` in `packages/testing/src/fake-account/fake-account-adapter.ts` — dispatches a create then an edit of the same id, with real `editedAt` and edit-accurate mentions, so the fake exercises the contract rather than a simplified stand-in (FR-027)
- [X] T021 [US1] Declare `"editNotifications"` in the fake adapter's supported capability set in `packages/testing/src/fake-account/fake-account-adapter.ts`
- [X] T022 [US1] Map `edit_date` to `editedAt` in `mapMessage()` in `packages/telegram/src/mapping/message.ts`, omitting the key when absent (FR-006, FR-007). Mentions need no change — recomputing from the edited message satisfies FR-008 for free (research D8)
- [X] T023 [US1] Generalize `hasDispatchableContent()` in `packages/telegram/src/webhook/telegram-webhook-handler.ts` to take a message rather than reading `update.message` directly, so it can serve both branches
- [X] T024 [US1] Handle `update.edited_message` in `packages/telegram/src/webhook/telegram-webhook-handler.ts`, dispatching `{ kind: "message.edited", message }`. Keep the dedup check ahead of the branch. **Do not** handle `edited_channel_post` — out of scope, since inbound `channel_post` is itself unhandled (research D5); add a comment saying so
- [X] T025 [US1] Add `dispatchInboundEdit()` (or an equivalent tagged path) to `TelegramAccountAdapter` in `packages/telegram/src/adapter/telegram-account-adapter.ts`, and declare `"editNotifications"` in `CAPABILITIES`
- [X] T026 [US1] Supply the `"edit"` scenario in `packages/telegram/tests/conformance.spec.ts`'s `emitInbound`, driving the adapter's real webhook path with a synthetic edited update

**Checkpoint**: US1 fully functional. An application can react to edits; nothing else has changed.
This is the MVP — it closes the correctness gap that exists today and is worth shipping alone.

---

## Phase 4: User Story 2 - A developer changes a message their application already sent (Priority: P1)

**Goal**: An application can edit a message in place, with the text/caption choice taken from the
provider rather than assumed, and every failure categorized.

**Independent Test**: Drive `editMessage` against a stubbed grammY `Api`; assert the call sequence
for text and caption messages, and assert the error class for each failure row. No credentials.

### Tests for User Story 2 ⚠️ Write first, confirm they fail

- [ ] T027 [P] [US2] Add `packages/telegram/tests/unit/edit-message.spec.ts` covering quickstart Scenario 5: text message → one `editMessageText`; caption message → `editMessageText` rejects with `there is no text in the message to edit`, then `editMessageCaption` succeeds; fallback also fails → the **fallback's** error surfaces. Assert the call **sequence**, not only the outcome (contracts/outbound-ops.md C9)
- [ ] T028 [P] [US2] Add error-mapping tests to `packages/telegram/tests/unit/errors.spec.ts` for every row of the C11 table, asserting error **classes** only — never message strings (FR-019, SC-004)
- [ ] T029 [P] [US2] Add the FR-020 test to `packages/telegram/tests/unit/errors.spec.ts`: `message is not modified` **rejects** as `ChatterConfigurationError`, and explicitly is **not** `ChatterInvalidTargetError` or `ChatterAuthorizationError` — assert what it must not be, since that is where the forbidden misattribution would show up (contracts/outbound-ops.md C10)
- [ ] T030 [P] [US2] Add capability-gate tests in `packages/core/tests/unit/capabilities.spec.ts`: `editMessage` on an account not declaring `"editMessage"` rejects with `ChatterUnsupportedCapabilityError` **and the stubbed adapter records zero calls** (FR-018, quickstart Scenario 8)
- [ ] T031 [US2] Add conformance checks for outbound operations in `packages/testing/src/conformance/conformance-suite.ts`: a rejected target surfaces a categorized error, an identical-content edit does not pass as success, and a declared capability without its method fails the suite (FR-026, FR-024)

### Implementation for User Story 2

- [ ] T032 [US2] Implement `editMessage()` on `FakeAccountAdapter` in `packages/testing/src/fake-account/fake-account-adapter.ts`, rejecting unknown message ids with `ChatterInvalidTargetError` and identical content with `ChatterConfigurationError` (FR-027)
- [ ] T033 [US2] Add `ChatterEditInput` (account-scoped) and `Chatter.editMessage()` to `packages/core/src/orchestrator/chatter.ts`, gating on capability **and** method presence before any adapter call, and dispatching the `outbound` event on success (FR-018, research D10)
- [ ] T034 [US2] Add the edit-scoped `message is not modified` → `ChatterConfigurationError` mapping in `packages/telegram/src/errors/map-telegram-error.ts`. **Scope it to the edit path** — do not add it to the global pattern table, so the same description arising elsewhere is not reinterpreted (research D2)
- [ ] T035 [US2] Add `message to edit not found` / `message can't be edited` → `ChatterInvalidTargetError` and the authorization rows to `packages/telegram/src/errors/map-telegram-error.ts` (C11)
- [ ] T036 [US2] Implement `editMessage()` on `TelegramAccountAdapter` in `packages/telegram/src/adapter/telegram-account-adapter.ts` with the caption fallback (C9), returning an `AdapterDeliveryResult` naming the edited message. Declare `"editMessage"` in `CAPABILITIES`
- [ ] T037 [US2] Add no-local-pre-judgement guard comments where a time-window check would be tempting in `packages/telegram/src/adapter/telegram-account-adapter.ts`, noting the deliberate contrast with `send()`'s length/size pre-validation (FR-021, C12)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - A developer removes a message from the conversation (Priority: P2)

**Goal**: An application can delete a message, with refusals distinguishable from absence.

**Independent Test**: Drive `deleteMessage` against a stubbed `Api`; assert the success result shape
and the error class for each refusal. No credentials.

### Tests for User Story 3 ⚠️ Write first, confirm they fail

- [ ] T038 [P] [US3] Add `packages/telegram/tests/unit/delete-message.spec.ts` covering quickstart Scenario 6: success resolves to a `DeliveryResult` naming the removed id and carrying **no `timestamp`** (C13); permission refusal → `ChatterAuthorizationError`; already-deleted → `ChatterInvalidTargetError`
- [ ] T039 [P] [US3] Add the elapsed-time refusal test to `packages/telegram/tests/unit/delete-message.spec.ts`, asserting `ChatterAuthorizationError` with the provider description preserved and the `GrammyError` attached as `cause` — pinning the known coarseness recorded in C11 so a future reader sees it as decided, not missed
- [ ] T040 [P] [US3] Add the `deleteMessage` capability-gate test to `packages/core/tests/unit/capabilities.spec.ts` (FR-018)

### Implementation for User Story 3

- [ ] T041 [US3] Implement `deleteMessage()` on `FakeAccountAdapter` in `packages/testing/src/fake-account/fake-account-adapter.ts` (FR-027)
- [ ] T042 [US3] Add `ChatterDeleteInput` and `Chatter.deleteMessage()` to `packages/core/src/orchestrator/chatter.ts`, gated identically to `editMessage` (FR-018)
- [ ] T043 [US3] Add `message to delete not found` and `message can't be deleted` rows to `packages/telegram/src/errors/map-telegram-error.ts` (C11)
- [ ] T044 [US3] Implement `deleteMessage()` on `TelegramAccountAdapter` in `packages/telegram/src/adapter/telegram-account-adapter.ts`, returning an `AdapterDeliveryResult` with no `timestamp`. Declare `"deleteMessage"` in `CAPABILITIES`

**Checkpoint**: All three operations work independently.

---

## Phase 6: User Story 4 - A developer learns what is actually supported (Priority: P3)

**Goal**: The three capabilities are independently discoverable at runtime, and the absence of
deletion notification is documented as a provider limitation rather than unfinished work.

**Independent Test**: Inspect a connected account's capability set; confirm all three report
independently and that nothing claims inbound deletion reporting.

### Tests for User Story 4 ⚠️ Write first

- [ ] T045 [P] [US4] Update the literal capability-set assertion in `packages/telegram/tests/unit/capabilities.spec.ts` (`size === 4` → `7`) and assert each new member individually — the one pre-existing assertion this feature is permitted to change (quickstart Scenario 10)
- [ ] T046 [P] [US4] Add a test in `packages/core/tests/unit/capabilities.spec.ts` constructing adapters declaring each new capability in isolation, proving they gate independently (FR-018, SC-003)

### Implementation for User Story 4

- [ ] T047 [P] [US4] Document the three capabilities in `packages/core/README.md`, with a dedicated subsection stating that inbound deletion notification is unavailable **because Telegram does not report it** — a provider limitation, not unfinished work (FR-014)
- [ ] T048 [P] [US4] Document edits and the two outbound operations in `packages/telegram/README.md`, including the caption two-round-trip cost (C9) and the FR-020 identical-content rejection with a worked `catch` example

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T049 [P] Add Bruno requests to `bruno/telegram-adapter/local-webhook/` for the edit path: `edited-message.yml`, `check-last-message-is-edit.yml` (asserts `editedAt` present, id matches, mentions reflect edited content), and `check-last-message-not-edited.yml`
- [ ] T050 Extend the `/last-message` introspection endpoint in `packages/telegram/tests/bruno/webhook-test-server.ts` to surface `editedAt` and the dispatched event kind — status codes cannot verify this feature, since a correct edit and a broken one both return `200`
- [ ] T051 Renumber received-count sequencing across `bruno/telegram-adapter/local-webhook/` (`check-received-count-*.yml` and the two `*-401.yml` security requests) — the collection runs as an ordered suite, so a stale count fails every downstream check, exactly as in 006
- [ ] T052 [P] Update `packages/testing/README.md` (if present) for the renamed `emitInbound` hook and the capability→scenario table
- [ ] T053 Run the full gate — `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and the Bruno collection — confirming every pre-existing test passes unmodified except T045 (quickstart Scenario 10)
- [ ] T054 Verify the FR-024 failure is real, not theoretical: temporarily remove `emitInbound` from `packages/telegram/tests/conformance.spec.ts` and confirm a failure naming the missing `"edit"` scenario, then restore it (quickstart Scenario 9.2). 006 verified its hook the same way — the check is worthless unless someone has watched it fail
- [ ] T055 Run `scripts/handoff.sh --reason ticket-complete --ticket 007-message-edits-deletions --summary "<summary>" --feature-complete` per AGENTS.md, appending to `Docs/Dev-log.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2. Independent of US1
- **US3 (Phase 5)**: depends on Phase 2. Independent of US1; shares error-mapping and orchestrator
  files with US2, so not fully parallel with it in practice
- **US4 (Phase 6)**: depends on US1–US3 having declared their capabilities
- **Polish (Phase 7)**: depends on all desired stories

### Within Each User Story

Tests written and failing → implementation → tests passing → documentation. Per the constitution's
Development Workflow, committed in small individually reviewable increments.

### Parallel Opportunities

- T002, T003 in parallel
- T004, T005, T006 in parallel (three separate core type files)
- T014 and T018/T019 in parallel (different packages)
- T027–T030 in parallel (four different test files)
- T038–T040 in parallel
- T045–T048 in parallel
- **Not parallel** despite appearances: T007–T010 (single atomic commit); T034/T035/T043 (all edit
  `map-telegram-error.ts`); T033/T042 (both edit `chatter.ts`); T036/T044 (both edit
  `telegram-account-adapter.ts`); T050/T051 (Bruno counts depend on the server change)

---

## Parallel Example: User Story 2

```bash
# All four US2 test files are independent — write them together:
Task: "Edit call-sequence tests in packages/telegram/tests/unit/edit-message.spec.ts"
Task: "Error-category tests in packages/telegram/tests/unit/errors.spec.ts"
Task: "FR-020 identical-content test in packages/telegram/tests/unit/errors.spec.ts"
Task: "Capability-gate tests in packages/core/tests/unit/capabilities.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **critical, blocks everything**
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart Scenarios 1–4 and 10

US1 alone is a coherent, shippable increment: it closes a correctness gap that exists *today*
(edits are silently dropped, so an application's view of a conversation diverges permanently).
US2–US4 add operations a developer chooses to perform, which is strictly less urgent.

### Incremental Delivery

1. Setup + Foundational → nothing observable changes; existing tests prove it
2. + US1 → applications can react to edits (**MVP**)
3. + US2 → applications can edit their own messages
4. + US3 → applications can delete messages
5. + US4 → capability discovery and the FR-012 documentation

---

## Notes

- The single riskiest moment is T007–T010. It is the only breaking change in the feature and must
  land atomically; a partial commit leaves the workspace non-compiling.
- Watch for the 006 trap in T022: entity arrays index into different strings (`entities` →
  `text`, `caption_entities` → `caption`), and `mapMessage` already chooses both by one branch.
  Do not split that decision while adding `editedAt`.
- T045 is the **only** pre-existing assertion permitted to change. If any other existing test needs
  touching, stop — it means something changed shape that FR-007 and SC-002 say must not have.
- Windows: `pnpm -r build` fails in `example-apps/chatter-desktop` (pre-existing, unrelated). Run
  `PYTHONIOENCODING=utf-8` for `.specify` Python scripts.
