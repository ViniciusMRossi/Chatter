---
description: "Task list for Mentions (006)"
---

# Tasks: Mentions

**Input**: Design documents from `/specs/006-mentions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mention-contract.md,
quickstart.md

**Tests**: Included — constitution Principle IV requires this, and spec.md's success criteria
(notably SC-003's UTF-16 slice invariant) are only verifiable through tests.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)

## Path Conventions

Three existing packages — `packages/core`, `packages/testing`, `packages/telegram` — plus
additions to the existing `bruno/telegram-adapter/` collection. No new package.

---

## Phase 1: Setup

**Purpose**: This working tree has no `node_modules`; nothing below can be run or verified until
dependencies are installed.

- [X] T001 Install workspace dependencies from the repo root with `pnpm install`, then confirm the
      baseline is green before changing anything: `pnpm -r build`, `pnpm -r test`. A pre-existing
      failure here must be understood before it can be distinguished from one this ticket causes.

**Checkpoint**: Known-good baseline established.

---

## Phase 2: Foundational (Blocking Prerequisite for US1-US4)

**Purpose**: The core `Mention` type is consumed by every other package in this ticket. Nothing in
`@chatter/testing` or `@chatter/telegram` compiles until it exists.

**⚠️ CRITICAL**: No user story can be completed until this phase is done.

- [X] T002 Create the `Mention` interface in `packages/core/src/types/mention.ts` per
      data-model.md: `text`, `offset`, `length` (both documented as UTF-16 code units, with the
      `"👋 @alice"` → offset 3 example), optional `participant`, and **required** `isSelf: boolean`.
      Include the doc comment explaining why `participant` is absent rather than fabricated.
- [X] T003 Add `readonly mentions?: readonly Mention[]` to the `Message` interface in
      `packages/core/src/types/message.ts`, with a doc comment stating the ordering rule (ascending
      by `offset`) and that the field is omitted entirely — never `[]` — when there are no mentions.
- [X] T004 [P] Widen `Capability` to include `"mentions"` in
      `packages/core/src/types/capability.ts`, with a comment noting it asserts **inbound reporting
      only** and makes no claim about outbound mention composition.
- [X] T005 Re-export `Mention` from `packages/core/src/types/index.ts` so it reaches consumers via
      `@chatter/core`'s public surface.
- [X] T006 Verify `pnpm --filter @chatter/core build` and `pnpm --filter @chatter/core test` pass —
      core is additive-only, so every existing test must still pass untouched (SC-007).

**Checkpoint**: Core contract exists; downstream packages can now be written against it.

---

## Phase 3: User Story 1 - A developer receives mentions as structured data (Priority: P1) 🎯 MVP

**Goal**: Telegram mention entities arrive as normalized, correctly-positioned `Mention`s on
inbound messages, with resolved and unresolved forms distinguished honestly.

**Independent Test**: Deliver synthetic webhook updates containing `mention` and `text_mention`
entities and confirm each produces a correspondingly positioned mention — no credentials involved.

### Tests first (Principle IV)

- [X] T007 [P] [US1] Write unit tests for `mapMentions` in
      `packages/telegram/tests/unit/mention-mapping.spec.ts` covering: a single `@handle` mention
      produces one mention with no `participant`; a `text_mention` produces one mention whose
      `participant` matches `mapParticipant`'s output; multiple mentions come back ascending by
      `offset`; a message with no entities returns `undefined` (not `[]`); an unrelated entity type
      (`bold`, `url`) produces nothing.
- [X] T008 [P] [US1] Write the SC-003 slice-invariant tests in the same file: for text containing
      plain ASCII, accented characters, and **at least one emoji before the mention**, assert
      `text.slice(m.offset, m.offset + m.length) === m.text` for every mention produced. This is the
      test that catches code-point/code-unit confusion (research.md §1) — it must fail against a
      deliberately code-point-based implementation.
- [X] T009 [P] [US1] Write the FR-007/SC-004 test asserting no mention is ever emitted with a
      fabricated identity: an `@handle` mention's `participant` is strictly `undefined`, not a
      `Participant` with the handle stuffed into `providerParticipantId`.
- [X] T010 [P] [US1] Write the FR-015 malformed-entity tests: an entity whose `offset` is negative,
      or whose `offset + length` exceeds the text length, is skipped rather than clamped, the
      remaining valid mentions still map, and the message is still dispatched.

### Implementation

- [X] T011 [US1] Create `packages/telegram/src/mapping/mention.ts` implementing `mapMentions` per
      contracts/mention-contract.md: map `text_mention` via the existing `mapParticipant`, map
      `mention` with no participant, ignore every other entity type, preserve order, bounds-check
      each entity against the text, and return `undefined` when nothing maps.
- [X] T012 [US1] Wire `mapMentions` into `mapMessage` in `packages/telegram/src/mapping/message.ts`,
      spreading `mentions` conditionally to match the existing `text`/`attachments`/
      `replyToMessageId` convention (FR-002).
- [X] T013 [US1] Run `pnpm --filter @chatter/telegram test` and confirm T007-T010 pass.

**Checkpoint**: Mentions reach application code with correct text, position, and resolution status.

---

## Phase 4: User Story 2 - A developer detects that their own account was addressed (Priority: P1)

**Goal**: An application can act only when addressed, without comparing any handle text itself.

**Independent Test**: Deliver messages addressing the connected account, addressing someone else,
and addressing no one; confirm `isSelf` is set only in the first case.

### Tests first

- [X] T014 [P] [US2] Write `isSelf` unit tests in
      `packages/telegram/tests/unit/mention-mapping.spec.ts`: a `text_mention` whose user id equals
      the bot's id sets `isSelf: true`; a `text_mention` of a different user does not; an `@handle`
      matching the bot's username sets `isSelf: true`; a non-matching handle does not.
- [X] T015 [P] [US2] Write the case-insensitivity test: `@ChAtTeR_TeSt_BoT` matches a bot whose
      canonical username is `chatter_test_bot` (research.md §4 — Telegram usernames are
      case-insensitive).
- [X] T016 [P] [US2] Write the FR-017 test: a message containing `/start@chatter_test_bot` produces
      **zero** mentions and no self signal. This is the test that pins the decision recorded in
      spec.md FR-017 and research.md §3 — if a future change makes it fail, that is a deliberate
      spec change, not a bug fix.
- [X] T017 [P] [US2] Write the no-username edge-case test: when `getMe` reports a bot with no
      `username`, handle-form mentions simply never match self — no throw, no crash.
- [X] T018 [P] [US2] Write the mixed-mentions test: a message mentioning both the bot and another
      user marks exactly one mention `isSelf` (spec.md US2 scenario 3).

### Implementation

- [X] T019 [US2] In `packages/telegram/src/adapter/telegram-account-adapter.ts`, capture
      `me.username` into a new `#botUsername` field in `start()`, from the `getMe()` response the
      method already makes. Do not add a second API call, and do not change the existing
      `ChatterAuthenticationError` path — FR-018 codifies it as-is.
- [X] T020 [US2] Thread the bot username through `mapInboundMessage()` → `mapMessage()` →
      `mapMentions()` in the same package.
- [X] T021 [US2] Implement `isSelf` in `mapping/mention.ts`: user-id equality for `text_mention`;
      case-insensitive, `@`-stripped username equality for `mention`.
- [X] T022 [US2] Run `pnpm --filter @chatter/telegram test` and confirm T014-T018 pass.

**Checkpoint**: "Only respond when addressed" works without consumer-side string matching.

---

## Phase 5: User Story 3 - Mentions inside media captions are not lost (Priority: P2)

**Goal**: A mention in a photo/video/document caption is reported exactly like one in message text.

**Independent Test**: Deliver a captioned attachment whose caption mentions someone; confirm the
mention is present and positioned against the caption text.

### Tests first

- [X] T023 [P] [US3] Write the caption-mention test in
      `packages/telegram/tests/integration/mention-round-trip.spec.ts`: a photo update with
      `caption` + `caption_entities` produces a message carrying both the attachment and the
      mention, with the slice invariant holding against the message's own `text`.
- [X] T024 [P] [US3] Write the lockstep-regression test — the one that catches research.md §5's
      failure mode: an update carrying **both** `text`/`entities` and `caption`/`caption_entities`
      with *deliberately different* offsets must map using the caption pair. Construct it so
      reading the wrong entity array yields a mention whose `text` disagrees with its own slice,
      rather than a superficially plausible result.
- [X] T025 [P] [US3] Write the no-caption test: a photo update with no caption produces no
      `mentions` field and no error.

### Implementation

- [X] T026 [US3] In `packages/telegram/src/mapping/message.ts`, derive the entity array from the
      **same** branch that already chooses `caption` vs `text`, so the two can never drift apart.
      Prefer a single expression yielding both values over two independent ternaries.
- [X] T027 [US3] Run `pnpm --filter @chatter/telegram test` and confirm T023-T025 pass.

**Checkpoint**: Both message surfaces carry mentions correctly.

---

## Phase 6: User Story 4 - Mention support is honestly declared and contract-tested (Priority: P3)

**Goal**: Capability declaration is accurate, and the shared conformance suite genuinely holds any
mention-declaring adapter to the same contract.

**Independent Test**: Run the conformance suite against a mentions-declaring and a
non-mentions-declaring adapter and confirm the right checks run in each case.

### Implementation

- [X] T028 [US4] Extend `ConformanceSuiteConfig` in
      `packages/testing/src/conformance/conformance-suite.ts` with the optional
      `emitInboundWithMentions?: (adapter: AccountAdapter) => void | Promise<void>` hook, documented
      per contracts/mention-contract.md.
- [X] T029 [US4] Add the mention conformance checks to `runAccountConformanceSuite()`: for an
      adapter declaring `"mentions"`, assert the slice invariant, ascending order, at least one
      resolved **and** one unresolved mention, no empty/placeholder participant ids, and correct
      `isSelf` assignment. **Fail explicitly — do not skip — when the hook is missing**, per
      research.md §6; silently skipping would make FR-012's guarantee fictional.
- [X] T030 [US4] Add the negative check: an adapter **not** declaring `"mentions"` must dispatch
      inbound messages with no `mentions` field.
- [X] T031 [US4] Extend `FakeAccountAdapter` in
      `packages/testing/src/fake-account/fake-account-adapter.ts` so it can be constructed with and
      without `"mentions"`, and add a test helper emitting an inbound message carrying resolved,
      unresolved, and self mentions.
- [X] T032 [US4] Wire both fake-adapter variants into
      `packages/testing/tests/conformance.spec.ts` so both branches actually execute.
- [X] T033 [US4] Add `"mentions"` to the `CAPABILITIES` set in
      `packages/telegram/src/adapter/telegram-account-adapter.ts` — only now that inbound mapping
      genuinely works (Principle III).
- [X] T034 [US4] Supply `emitInboundWithMentions` in `packages/telegram/tests/conformance.spec.ts`
      using the existing stub transport and webhook handler, and update
      `packages/telegram/tests/unit/capabilities.spec.ts` for the widened capability set.
- [X] T035 [US4] Deliberately verify the guard works: temporarily remove the Telegram hook, confirm
      the suite **fails** with the explicit message, then restore it. A skip here is a regression in
      the contract itself.

**Checkpoint**: The capability model is honest and the conformance claim is real.

---

## Phase 7: API collection & documentation (same PR — AGENTS.md)

- [X] T036 [P] Add `bruno/telegram-adapter/local-webhook/mention-message.yml`: a webhook update
      carrying both an `@handle` and a `text_mention` entity, with a `tests` block asserting a 2xx
      and that the update was accepted — following `photo-message.yml`'s shape.
- [X] T037 [P] Add `bruno/telegram-adapter/local-webhook/bot-command-not-a-mention.yml`: an update
      containing `/start@chatter_test_bot`, documenting FR-017 as executable behavior.
- [X] T038 Add `bruno/telegram-adapter/local-webhook/check-received-count-after-mentions.yml`
      following the existing `check-received-count-after-media.yml` convention, and confirm the
      count sequencing across the whole folder still holds — the existing
      `check-received-count-final.yml` expectation shifts by the number of updates added above and
      must be updated in the same change, or the collection fails as a suite.
- [X] T039 Run `pnpm --filter @chatter/telegram test:bruno` and confirm the full collection passes
      against the stub-backed server, with no real credentials.
- [X] T040 [P] Update `packages/core/README.md`: document `Mention`, the UTF-16 code-unit offset
      convention with the emoji example, the ordering rule, and why `participant` may be absent.
- [X] T041 [P] Update `packages/telegram/README.md`: state which Telegram mention forms are
      resolvable (`text_mention` yes, `@handle` no, and why), and that `/command@botname` is
      deliberately not a mention, linking the reasoning to FR-017.

---

## Phase 8: Polish & full gate

- [X] T042 Run the complete gate from quickstart.md: `pnpm -r lint`, `pnpm -r typecheck`,
      `pnpm -r test`, `pnpm --filter @chatter/telegram test:bruno`.
- [X] T043 Re-verify SC-007 explicitly: messages with no mentions are unchanged in shape, and no
      existing test required modification to accommodate this feature. If any existing assertion had
      to change, that is a backward-compatibility break to justify or undo, not a test to update.
- [X] T044 Run `scripts/handoff.sh --reason ticket-complete --ticket 006-mentions --summary "..."
      --feature-complete` per AGENTS.md.

---

## Dependencies

```text
Phase 1 (Setup)
   └─> Phase 2 (Foundational: core types)
          ├─> Phase 3 (US1: mention mapping)            🎯 MVP
          │      └─> Phase 4 (US2: isSelf)   — shares mapping/mention.ts with US1
          │             └─> Phase 5 (US3: captions)     — shares mapping/message.ts
          │                    └─> Phase 6 (US4: capability + conformance)
          │                           └─> Phase 7 (Bruno + docs)
          │                                  └─> Phase 8 (full gate)
```

US1 → US2 → US3 are sequential in practice despite being separate stories: they modify the same two
files (`mapping/mention.ts`, `mapping/message.ts`). Their **tests** are independent and parallel;
their implementations are not. US4 is genuinely independent of US1-US3 except that T033 must not
declare the capability until the mapping actually works.

## Parallel opportunities

- T007-T010 (US1 tests) — all in one new file, independent of each other's content.
- T014-T018 (US2 tests) — all independent.
- T023-T025 (US3 tests) — all independent.
- T036, T037, T040, T041 — Bruno requests and READMEs touch four separate files.
- T004 is parallel with T002/T003 (different file, no shared symbol).

## Implementation strategy

**MVP = Phase 1 + Phase 2 + Phase 3.** That delivers mentions as structured, correctly-positioned
data — useful on its own, and the foundation everything else builds on.

**Recommended increment order**: MVP → US2 (the reason most consumers want this feature at all) →
US3 (closes a real gap) → US4 (makes the contract enforceable) → Bruno/docs → gate.

Commit in small reviewable increments per the constitution's Development Workflow: tests → code →
passing tests → documentation, not one commit at the end.
