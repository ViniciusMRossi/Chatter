---
description: "Task list for Core Package Foundation (001)"
---

# Tasks: Core Package Foundation

**Input**: Design documents from `/specs/001-core-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core-api.md, quickstart.md

**Tests**: Included — constitution Principle IV (test-first) and spec.md FR-013 both require this
work to be verifiable without a real provider, so tests are not optional here.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Single pnpm workspace, two packages this phase: `packages/core/`, `packages/testing/` (see
plan.md Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace scaffolding — nothing story-specific yet.

- [X] T001 Create pnpm workspace scaffold: `pnpm-workspace.yaml`, root `package.json` (private,
      no publish), `tsconfig.base.json` (strict mode, ESM/`NodeNext` resolution) at repo root;
      create empty `packages/core/` and `packages/testing/` directories. Note: `pnpm` must be on
      `PATH` (activate via `corepack enable && corepack prepare pnpm@latest --activate`, may
      need elevated permission on this machine — see Docs/handoff.md if it was flagged there).
- [X] T002 [P] Configure `packages/core/package.json` (`"name": "@chatter/core"`, `"type":
      "module"`, `"private": true` for now) and `packages/core/tsconfig.json` extending
      `tsconfig.base.json`.
- [X] T003 [P] Configure `packages/testing/package.json` (`"name": "@chatter/testing"`,
      `"type": "module"`, depends on `@chatter/core` via the `workspace:*` protocol) and
      `packages/testing/tsconfig.json` extending `tsconfig.base.json`.
- [X] T004 [P] Configure Vitest for both packages (`packages/core/vitest.config.ts`,
      `packages/testing/vitest.config.ts`, or a single `vitest.workspace.ts` at repo root —
      per research.md's Testing decision).
- [X] T005 [P] Choose and document linting/formatting tooling: replace the "TBD" line in
      `Docs/Tech-Stack-Constitution.md` with the actual choice (ESLint + Prettier, or Biome),
      then add the corresponding root-level config file(s).
- [X] T006 [P] Add `.github/workflows/ci.yml` running `pnpm install`, typecheck, lint, and test
      across the workspace on every PR, alongside the existing
      `.github/workflows/tier1-security.yml`.

**Checkpoint**: Workspace installs, typechecks (on empty packages), and CI is wired.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The normalized type model, error hierarchy, and adapter contract every user story
depends on. No user story can start before this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 [P] Define reference-key types (`AccountKey`, `ParticipantKey`, `ConversationKey`,
      `ThreadKey`, composed exactly as in data-model.md "Reference keys") in
      `packages/core/src/types/ids.ts`.
- [X] T008 [P] Define domain types — `Provider`, `Account`, `Participant`, `Conversation`
      (with `type: "direct" | "group" | "channel" | "unknown"`), `Message`,
      `MessageCreatedEvent`, `Capability` (`"text" | "reply" | "thread"`), `DeliveryResult` — per
      data-model.md, in `packages/core/src/types/{provider,account,participant,conversation,
      message,event,capability,delivery-result}.ts`.
- [X] T009 [P] Implement the `ChatterError` hierarchy (`ChatterError` abstract base +
      `ChatterConfigurationError`, `ChatterAuthenticationError`, `ChatterAuthorizationError`,
      `ChatterRateLimitError` (with `retryable`, `retryAfterMs?`),
      `ChatterInvalidTargetError`, `ChatterUnsupportedCapabilityError`,
      `ChatterProviderUnavailableError` (with `retryable`), `ChatterUnknownError`) per
      research.md, in `packages/core/src/errors/*.ts`.
- [X] T010 Define the `AccountAdapter` contract interface (`provider`, `getCapabilities()`,
      `start(dispatch)`, `stop()`, `send(input)`) per contracts/core-api.md, in
      `packages/core/src/adapter/adapter.ts`. Depends on: T007, T008, T009.
- [X] T011 Implement `packages/core/src/index.ts` barrel export of all public types, errors, and
      the adapter interface. Depends on: T007, T008, T009, T010.

**Checkpoint**: Foundation ready — type model, errors, and the adapter contract compile and are
exported. User story implementation can now begin.

---

## Phase 3: User Story 1 - Round-trip a text message with no real provider (Priority: P1) 🎯 MVP

**Goal**: A developer can register a fake account, start the library, receive a normalized
inbound text message, and send a normalized reply — entirely in-process.

**Independent Test**: Run the Quickstart.md §3 script end-to-end; `fake.sentMessages` contains
exactly the expected echo reply.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they fail before implementing.

- [X] T012 [P] [US1] Write failing unit test for `Chatter` start/stop lifecycle (start is
      idempotent, stop is idempotent, `send()` before `start()` or after `stop()` rejects with
      `ChatterConfigurationError`) in `packages/core/tests/unit/lifecycle.spec.ts`.
- [X] T013 [P] [US1] Write failing integration test for the full send/receive round trip
      (register one fake account, start, emit an inbound message, handler sends a reply,
      assert the delivery result shape) in
      `packages/core/tests/integration/round-trip.spec.ts`.

### Implementation for User Story 1

- [X] T014 [US1] Implement `FakeAccountAdapter` (`start`, `stop`, `send`, `getCapabilities`,
      plus test helpers `emitInbound` and `sentMessages`) implementing the `AccountAdapter`
      contract, in `packages/testing/src/fake-account/fake-account-adapter.ts`. Depends on:
      T010.
- [X] T015 [US1] Implement the `Chatter` orchestrator's constructor, `start()`/`stop()`
      lifecycle, and `EventEmitter`-backed `on()`/`off()` inbound dispatch (per research.md's
      event-delivery decision), including minimal structured lifecycle/inbound observability
      events (NFR-008), in `packages/core/src/orchestrator/chatter.ts`. Depends on: T010, T014.
- [X] T016 [US1] Implement `Chatter.send()` outbound routing to the correct adapter, returning a
      typed `DeliveryResult`, including minimal outbound/error observability events (NFR-008),
      in `packages/core/src/orchestrator/chatter.ts`. Depends on: T015.
- [X] T017 [P] [US1] Add `packages/testing/src/index.ts` barrel export. Depends on: T014.
- [X] T018 [US1] Run `pnpm -r test` and confirm T012 and T013 now pass.

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Run multiple accounts in one process without collisions (Priority: P2)

**Goal**: Two accounts can be registered, started, and used in one process with no message,
reply, or error from one ever attributed to the other.

**Independent Test**: Run Quickstart.md §4 — two `FakeAccountAdapter` instances, distinct
inbound messages, verified per-account attribution.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Write failing unit test: registering two accounts under the same
      `accountName` throws `ChatterConfigurationError` synchronously at construction, in
      `packages/core/tests/unit/registration.spec.ts`.
- [X] T020 [P] [US2] Write failing integration test: two fake accounts, one inbound message
      each, confirm each event reports the correct `account`, and a reply sent "from" one
      account never appears in the other's `sentMessages`, in
      `packages/core/tests/integration/multi-account.spec.ts`.

### Implementation for User Story 2

- [X] T021 [US2] Implement `accountName` uniqueness validation in the `Chatter` constructor
      (throwing `ChatterConfigurationError`) in `packages/core/src/orchestrator/chatter.ts`.
      Depends on: T015.
- [X] T022 [US2] Confirm/adjust per-account tagging on inbound event dispatch and outbound send
      routing so accounts are fully isolated, in `packages/core/src/orchestrator/chatter.ts`.
      Depends on: T021. Run `pnpm -r test` and confirm T019 and T020 pass.

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Understand failures and capabilities without guessing (Priority: P3)

**Goal**: Rate-limit, invalid-target, and unsupported-capability failures are each identifiable
as distinct typed errors, and capabilities are queryable in advance.

**Independent Test**: Run Quickstart.md §5 — each of the three failure triggers produces the
expected error subclass.

### Tests for User Story 3 ⚠️

- [ ] T023 [P] [US3] Write failing unit test: `Chatter.getCapabilities(accountName)` reflects
      the fake account's declared capability set, in
      `packages/core/tests/unit/capabilities.spec.ts`.
- [ ] T024 [P] [US3] Write failing unit test: a thread-targeted send on an account constructed
      without the `"thread"` capability rejects with `ChatterUnsupportedCapabilityError`, in
      `packages/core/tests/unit/capabilities.spec.ts`.
- [ ] T025 [P] [US3] Write failing unit test: a send targeting an unrecognized conversation/
      message reference rejects with `ChatterInvalidTargetError`, in
      `packages/core/tests/unit/errors.spec.ts`.
- [ ] T026 [P] [US3] Write failing unit test: after calling `FakeAccountAdapter.
      simulateRateLimit(retryAfterMs)`, the next `send()` rejects with `ChatterRateLimitError`
      exposing `retryable: true` and the given `retryAfterMs`, in
      `packages/testing/tests/fake-account.spec.ts`.

### Implementation for User Story 3

- [ ] T027 [US3] Implement capability-aware validation (unsupported-capability and
      invalid-target checks) in `FakeAccountAdapter.send()` and confirm `Chatter.send()`
      propagates the resulting typed errors unchanged, in
      `packages/testing/src/fake-account/fake-account-adapter.ts` and
      `packages/core/src/orchestrator/chatter.ts`. Depends on: T016, T014.
- [ ] T028 [US3] Implement `FakeAccountAdapter.simulateRateLimit()` in
      `packages/testing/src/fake-account/fake-account-adapter.ts`. Depends on: T014. Run
      `pnpm -r test` and confirm T023–T026 pass.

**Checkpoint**: User Stories 1, 2, and 3 all independently functional.

---

## Phase 6: User Story 4 - Prove a new adapter meets the contract before shipping it (Priority: P4)

**Goal**: A reusable, adapter-agnostic conformance suite exists, passes against the fake
adapter, and provably fails when the fake adapter is broken.

**Independent Test**: Run Quickstart.md §6 — break `FakeAccountAdapter`, confirm the suite
fails with a clear assertion, revert.

### Implementation for User Story 4

- [ ] T029 [US4] Implement `runAccountConformanceSuite(createAdapter)` — covering capability
      query, send + delivery-result shape, invalid-target rejection, unsupported-capability
      rejection, and start/stop idempotency — per contracts/core-api.md, in
      `packages/testing/src/conformance/conformance-suite.ts`. Depends on: T010, T014, T027,
      T028.
- [ ] T030 [P] [US4] Add `packages/testing/tests/conformance.spec.ts` calling
      `runAccountConformanceSuite(() => new FakeAccountAdapter())`. Depends on: T029.
- [ ] T031 [US4] Manually verify failure detection per quickstart.md §6: temporarily remove
      `conversation` from `FakeAccountAdapter.send()`'s returned `DeliveryResult`, re-run
      `pnpm -r test`, confirm `runAccountConformanceSuite` fails with a clear assertion, then
      revert the change. Record the confirmation in the pull request description. Depends on:
      T030.

**Checkpoint**: All four user stories independently functional — ticket is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final verification, once every story above is done.

- [ ] T032 [P] Write `packages/core/README.md` and `packages/testing/README.md` (setup,
      minimal usage example, link to the public API contract) per NFR-011.
- [ ] T033 [P] Walk through quickstart.md end-to-end manually and fix any discrepancy found
      between the documented steps and actual behavior.
- [ ] T034 Run `pnpm -r typecheck && pnpm -r lint && pnpm -r test` locally to confirm the CI
      workflow from T006 will pass before opening the pull request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only. This is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; builds directly on the `Chatter`
  orchestrator from US1 (T015/T016), so in practice implement after US1.
- **User Story 3 (Phase 5)**: Depends on Foundational; also builds on `FakeAccountAdapter.send()`
  and `Chatter.send()` from US1 — implement after US1 (US2 and US3 are independent of each
  other and could be parallelized across two developers once US1 is done).
- **User Story 4 (Phase 6)**: Depends on the adapter contract (Foundational) and on
  `FakeAccountAdapter` behavior from US1 and US3 (T027, T028), since the conformance suite
  asserts on invalid-target/unsupported-capability behavior implemented there. Implement last.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- All `[P]` tasks within Phase 1 (T002–T006) can run in parallel once T001 exists.
- All `[P]` tasks within Phase 2 (T007–T009) can run in parallel; T010 and T011 are sequential
  after them.
- Within each user story's test block, all `[P]` test tasks can be written in parallel.
- User Stories 2 and 3 can be implemented in parallel by different people once User Story 1's
  checkpoint is reached (both depend on US1's orchestrator/adapter code, not on each other).

---

## Parallel Example: User Story 1

```bash
# Tests, in parallel:
Task: "Write failing unit test for Chatter start/stop lifecycle in packages/core/tests/unit/lifecycle.spec.ts"
Task: "Write failing integration test for round trip in packages/core/tests/integration/round-trip.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: run Quickstart.md §2–§3 independently.
4. This alone proves the roadmap's Phase 1 exit criteria ("a test application can receive and
   send normalized text messages entirely through the fake adapter") — everything after this is
   hardening, not architecture validation.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate → this is the MVP.
3. User Story 2 → validate → multi-account safety proven.
4. User Story 3 → validate → typed-error/capability surface proven.
5. User Story 4 → validate → the contract is now enforceable for the next (Telegram) ticket.
6. Polish → documentation and CI confirmation, then open the PR.
