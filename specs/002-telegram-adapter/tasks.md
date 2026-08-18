---
description: "Task list for Telegram Provider Adapter (002)"
---

# Tasks: Telegram Provider Adapter

**Input**: Design documents from `/specs/002-telegram-adapter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/telegram-adapter-api.md, quickstart.md

**Tests**: Included — constitution Principle IV and spec.md FR-009/FR-010 require this work to
be test-first and CI-safe with zero real credentials.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)

## Path Conventions

New sibling package `packages/telegram/` in the existing pnpm workspace (see plan.md), plus a
non-package example app at `example-apps/telegram-echo/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New-package scaffolding, mirroring ticket #1's `packages/testing` shape.

- [X] T001 Create `packages/telegram/package.json` (`"name": "@chatter/telegram"`, `"type":
      "module"`, depends on `@chatter/core` via `workspace:*`) and
      `packages/telegram/tsconfig.json` (extends `tsconfig.base.json`, `composite: true`,
      references `../core`), matching `packages/testing`'s shape from ticket #1.
- [X] T002 [P] Add `grammy` as a runtime dependency of `packages/telegram`.
- [X] T003 [P] Configure `packages/telegram/vitest.config.ts` and
      `packages/telegram/tsconfig.eslint.json` (include `src`, `tests`, `*.config.ts`), matching
      the existing packages' pattern.
- [X] T004 [P] Add `example-apps/*` to the `packages:` glob in `pnpm-workspace.yaml`, and create
      `example-apps/telegram-echo/package.json` + `tsconfig.json` (depends on `@chatter/core` and
      `@chatter/telegram` via `workspace:*`; not published — no `exports`/`files` fields needed).

**Checkpoint**: `packages/telegram` and `example-apps/telegram-echo` exist, install cleanly, and
are picked up by the workspace-wide `typecheck`/`lint`/`test` scripts (even with empty content).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config types, Telegram→Chatter mapping, error mapping, and the shared stubbed-
transport test harness every user story below depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Define `TelegramAccountConfig` (`botToken`, `webhookSecret`, `webhookUrl`) in
      `packages/telegram/src/config/telegram-account-config.ts`, per data-model.md.
- [X] T006 [P] Implement Telegram `chat.type` → `ConversationType` mapping and
      Chat/User → `Conversation`/`Participant` mapping in
      `packages/telegram/src/mapping/{conversation,participant}.ts`, per data-model.md's mapping
      tables (`"private"`→`"direct"`, `"group"`/`"supergroup"`→`"group"`, else→`"unknown"`).
- [X] T007 [P] Implement Telegram `message` → `Message` mapping in
      `packages/telegram/src/mapping/message.ts` (id, text, createdAt, replyToMessageId).
      Depends on: T006.
- [X] T008 Implement the Telegram error → `ChatterError` mapping function in
      `packages/telegram/src/errors/map-telegram-error.ts` per research.md's mapping table
      (401→ChatterAuthenticationError, chat-not-found/blocked→ChatterInvalidTargetError,
      429→ChatterRateLimitError with `retryAfterMs`, network/5xx→ChatterProviderUnavailableError,
      else→ChatterUnknownError with `cause`), sanitizing the bot token out of any message it
      constructs.
- [X] T009 Build a stubbed grammY transport test harness (records outbound calls, returns canned
      success/error payloads) in `packages/telegram/tests/support/stub-transport.ts` — shared
      infrastructure every later test in this ticket uses to avoid real network calls.
- [X] T010 [P] Add `packages/telegram/src/index.ts` barrel export scaffold (re-exporting as each
      piece below lands). Depends on: T005, T006, T007, T008.

**Checkpoint**: Config, mapping, and error-translation logic compile and are exported; the test
harness is ready. User story implementation can now begin.

---

## Phase 3: User Story 1 - Round-trip a message in a direct chat with a real bot (Priority: P1) 🎯 MVP

**Goal**: A direct-chat text message delivered via webhook produces a normalized event, and a
reply sent through the adapter reaches Telegram via a correctly-mapped outbound call.

**Independent Test**: Feed a synthetic private-chat `Update` through the webhook handler (valid
secret) and confirm a `message.created` event with conversation type `"direct"`; then call
`send()` with a reply and confirm the stubbed transport recorded the correct `sendMessage` call.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] Write failing unit test: `chat.type: "private"` maps to conversation type
      `"direct"` in `packages/telegram/tests/unit/mapping.spec.ts`.
- [X] T012 [P] [US1] Write failing integration test: a synthetic direct-chat `Update` POSTed to
      the webhook handler dispatches one normalized `message.created` event; a subsequent
      `send()` reply is recorded by the stubbed transport with the correct chat ID and
      `reply_parameters`, in `packages/telegram/tests/integration/direct-chat.spec.ts`.

### Implementation for User Story 1

- [X] T013 [US1] Implement `TelegramAccountAdapter.start()` (`getMe()` to resolve
      `providerAccountId`, throwing `ChatterAuthenticationError` on failure per data-model.md;
      then `setWebhook` registration) and `stop()` (`deleteWebhook`, clear stored dispatch;
      must not throw if `start()` never completed) in
      `packages/telegram/src/adapter/telegram-account-adapter.ts`. Depends on: T005, T008, T009.
- [X] T014 [US1] Implement `TelegramAccountAdapter.send()` (Telegram `sendMessage` with
      `reply_parameters` when `replyToMessageId` is set; maps the response to
      `AdapterDeliveryResult`; routes failures through the T008 error mapper) in the same file.
      Depends on: T013.
- [X] T015 [US1] Implement `createTelegramWebhookHandler()` (parses the `Update` body, applies
      the T007 message mapping, calls `dispatch`) in
      `packages/telegram/src/webhook/telegram-webhook-handler.ts`. Depends on: T006, T007, T013.
- [X] T016 [US1] Wire `packages/telegram/src/index.ts` to export `TelegramAccountAdapter`,
      `createTelegramWebhookHandler`, and `TelegramAccountConfig`. Depends on: T013, T014, T015.
- [X] T017 [US1] Run `pnpm -r test` and confirm T011 and T012 now pass.

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP for
this ticket.

---

## Phase 4: User Story 2 - The same code also works in a group chat (Priority: P1)

**Goal**: The identical adapter/handler code correctly reports `"group"` for group and supergroup
chats, with conversation references distinct from any direct chat.

**Independent Test**: Feed a synthetic group-chat `Update` through the same webhook handler and
confirm conversation type `"group"`, with a reply routing back to the correct group chat ID.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Write failing unit test: `chat.type: "group"` and `chat.type:
      "supergroup"` both map to conversation type `"group"`, in
      `packages/telegram/tests/unit/mapping.spec.ts`.
- [X] T019 [P] [US2] Write failing integration test: a synthetic group-chat `Update` round-trips
      through the same webhook handler and `send()` path as US1, with a conversation reference
      distinct from the US1 direct-chat one, in
      `packages/telegram/tests/integration/group-chat.spec.ts`.

### Implementation for User Story 2

- [X] T020 [US2] Verify/adjust the T006 conversation mapping and T013-T015 adapter/handler code
      handle group chats correctly with no group-specific branching beyond the mapping table
      itself, in `packages/telegram/src/mapping/conversation.ts`. Depends on: T006, T013, T015.
      Run `pnpm -r test` and confirm T018 and T019 pass.

**Checkpoint**: User Stories 1 and 2 both independently functional — the Phase 2 roadmap exit
criterion (same code, both conversation types) is met.

---

## Phase 5: User Story 3 - Forged or missing webhook requests never reach application code (Priority: P2)

**Goal**: Webhook requests without the correct secret are rejected before any parsing or dispatch
occurs.

**Independent Test**: Send requests with a missing secret, a wrong secret, and the correct
secret; confirm only the last one results in dispatch.

### Tests for User Story 3 ⚠️

- [ ] T021 [P] [US3] Write failing unit test: a webhook request with no secret header is
      rejected (401-equivalent `Response`) and `dispatch` is never called, in
      `packages/telegram/tests/unit/webhook-security.spec.ts`.
- [ ] T022 [P] [US3] Write failing unit test: a webhook request with an incorrect secret is
      rejected the same way, in the same file.
- [ ] T023 [P] [US3] Write failing unit test: a webhook request with the correct secret is
      accepted and processed normally, in the same file.

### Implementation for User Story 3

- [ ] T024 [US3] Implement timing-safe secret validation (`crypto.timingSafeEqual`, handling the
      missing-header/length-mismatch case without calling it) as the first step of
      `createTelegramWebhookHandler()`, before any `Update` body parsing, in
      `packages/telegram/src/webhook/telegram-webhook-handler.ts`. Depends on: T015. Run
      `pnpm -r test` and confirm T021-T023 pass.

**Checkpoint**: User Stories 1-3 all independently functional.

---

## Phase 6: User Story 4 - Failures are identifiable, not mysterious (Priority: P2)

**Goal**: Telegram-specific failures map to distinct, correctly-typed `ChatterError` subclasses
with retry metadata where applicable; capabilities are reported accurately; secrets never leak
into error output.

**Independent Test**: Trigger each failure condition via the stubbed transport and confirm the
resulting error type, `retryable`/`retryAfterMs` where relevant, and capability set.

### Tests for User Story 4 ⚠️

- [ ] T025 [P] [US4] Write failing unit test: a synthetic 401 "Unauthorized" response maps to
      `ChatterAuthenticationError`, in `packages/telegram/tests/unit/errors.spec.ts`.
- [ ] T026 [P] [US4] Write failing unit test: synthetic "chat not found" (400) and "bot was
      blocked"/"kicked" (403) responses both map to `ChatterInvalidTargetError`, in the same
      file.
- [ ] T027 [P] [US4] Write failing unit test: a synthetic 429 response with `retry_after: 5`
      maps to `ChatterRateLimitError` with `retryable: true` and `retryAfterMs: 5000`, in the
      same file.
- [ ] T028 [P] [US4] Write failing unit test: `TelegramAccountAdapter.getCapabilities()` returns
      exactly `{"text", "reply"}` — `has("thread")` is `false` — in
      `packages/telegram/tests/unit/capabilities.spec.ts`.
- [ ] T029 [P] [US4] Write failing unit test: triggering an authentication failure with a known
      bot token/webhook secret produces an error whose `message` (and any `cause` chain) does
      not contain either secret value, in
      `packages/telegram/tests/unit/secret-redaction.spec.ts`.

### Implementation for User Story 4

- [ ] T030 [US4] Complete the T008 error-mapping function to cover every case above and ensure
      every `TelegramAccountAdapter` call site (`start()`, `send()`) routes grammY-originated
      errors through it rather than propagating them raw, in
      `packages/telegram/src/errors/map-telegram-error.ts` and
      `packages/telegram/src/adapter/telegram-account-adapter.ts`. Depends on: T008, T013, T014.
- [ ] T031 [US4] Set `getCapabilities()` to return exactly `{"text", "reply"}` in
      `packages/telegram/src/adapter/telegram-account-adapter.ts`. Depends on: T013. Run
      `pnpm -r test` and confirm T025-T029 pass.

**Checkpoint**: User Stories 1-4 all independently functional.

---

## Phase 7: User Story 5 - The adapter is provably compliant with the shared contract, without live credentials (Priority: P3)

**Goal**: The unmodified ticket #1 conformance suite passes against this adapter, and the full
test suite requires zero real Telegram credentials.

**Independent Test**: Run `runAccountConformanceSuite` unmodified against
`TelegramAccountAdapter` (stubbed transport), and run the full `packages/telegram` test suite
with no `TELEGRAM_*` environment variables set.

### Implementation for User Story 5

- [ ] T032 [US5] Implement `getKnownConversation`/`getUnknownConversation` config functions for
      the conformance suite — `getKnownConversation` feeds a synthetic `Update` through the real
      webhook handler (T024's validated path) to register a chat, mirroring a real webhook
      delivery; `getUnknownConversation` returns a chat ID never delivered — and add
      `packages/telegram/tests/conformance.spec.ts` calling
      `runAccountConformanceSuite({ createAdapter, getKnownConversation, getUnknownConversation
      })` unmodified from `@chatter/testing`. Depends on: T009, T013, T014, T015, T024, T030.
- [ ] T033 [US5] Run `pnpm -r test` with no `TELEGRAM_*` environment variables set and confirm
      the full suite, including `conformance.spec.ts`, passes.

**Checkpoint**: All five user stories independently functional — ticket is feature-complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the example app, and final verification, once every story above is
done.

- [ ] T034 [P] Write `packages/telegram/README.md`: BotFather bot creation, obtaining a token,
      webhook setup (including local-tunnel guidance), required permissions, supported
      capabilities, and known limitations, per FR-011/NFR-011.
- [ ] T035 [P] Build `example-apps/telegram-echo/src/index.ts` (the same handler shape as
      ticket #1's illustrative example, wired to `@chatter/telegram`, with a minimal Node `http`
      server exposing the webhook handler) and `example-apps/telegram-echo/README.md` (how to
      run it against a real bot + tunnel), per FR-012 and quickstart.md's manual-validation
      section.
- [ ] T036 [P] Walk through quickstart.md's automated section end-to-end, and check the manual
      section's commands/instructions are internally consistent with the actual example app and
      adapter code (a real Telegram bot isn't available in this environment, so the manual tier
      is a documentation-consistency check here, not a live run).
- [ ] T037 Run `pnpm -r typecheck && pnpm -r lint && pnpm -r test` locally to confirm CI will
      pass before opening the pull request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only. This is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; builds directly on US1's adapter/handler
  code — implement after US1.
- **User Story 3 (Phase 5)**: Depends on Foundational and US1's webhook handler (T015) — the
  secret check is inserted into that same function. Implement after US1; independent of US2.
- **User Story 4 (Phase 6)**: Depends on Foundational and US1's adapter (`start()`/`send()`
  call sites) — implement after US1; independent of US2/US3.
- **User Story 5 (Phase 7)**: Depends on US1's full adapter/handler, US3's secret validation
  (the conformance suite's `getKnownConversation` goes through the real, validated webhook
  path), and US4's completed error mapping. Implement last.
- **Polish (Phase 8)**: Depends on all five user stories being complete.

### Parallel Opportunities

- All `[P]` tasks within Phase 1 (T002-T004) can run in parallel once T001 exists.
- All `[P]` tasks within Phase 2 (T005-T007, T010) can run in parallel; T008 and T009 are
  independent of each other and of T005-T007.
- Within each user story's test block, all `[P]` test tasks can be written in parallel.
- User Stories 3 and 4 can be implemented in parallel by different people once User Story 1's
  checkpoint is reached (both depend on US1's code, not on each other).

---

## Parallel Example: User Story 1

```bash
# Tests, in parallel:
Task: "Write failing unit test for chat.type private -> direct mapping in packages/telegram/tests/unit/mapping.spec.ts"
Task: "Write failing integration test for direct-chat round trip in packages/telegram/tests/integration/direct-chat.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: run the automated tier of quickstart.md.
4. This alone proves the adapter can round-trip a real message shape end-to-end against a
   stubbed transport — the core risk this ticket exists to retire.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate → adapter round-trips in a direct chat.
3. User Story 2 → validate → the Phase 2 roadmap exit criterion (same code, both conversation
   types) is met.
4. User Story 3 → validate → webhook endpoint is safe to expose publicly.
5. User Story 4 → validate → failures are diagnosable and capabilities are honest.
6. User Story 5 → validate → the contract is provably honored, credential-free in CI.
7. Polish → documentation, example app, and CI confirmation, then open the PR.
