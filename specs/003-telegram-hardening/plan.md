# Implementation Plan: Telegram Adapter Hardening

**Branch**: `003-telegram-hardening` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-telegram-hardening/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Hardens `@chatter/telegram` (from ticket #2) against four conditions never exercised by the
existing stubbed-transport test suite: duplicate webhook redelivery, group→supergroup migration,
oversized outbound text, and a silently-swallowed shutdown cleanup failure. All changes are
internal to the adapter — no change to `AccountAdapter`, the webhook handler signature, the
capability set, or the `ChatterError` hierarchy. Closes with a documented manual checklist for
verifying the adapter against a real Telegram bot, which no automated suite can substitute for.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js active LTS — unchanged from tickets #1/#2.

**Primary Dependencies**: None new. Still grammY's standalone `Api` client + `@grammyjs/types`,
as established in ticket #2.

**Storage**: N/A — the update-ID dedup window is bounded, in-memory, and non-durable by design
(constitution Principle VI); nothing new is persisted.

**Testing**: Vitest, against the existing `StubTelegramTransport` harness (`tests/support/
stub-transport.ts`) from ticket #2 — no real network calls, no new test infrastructure needed
beyond what that harness already provides (it already supports queuing arbitrary synthetic
`ApiError` responses, which covers the migration-signal and oversized-message scenarios).

**Target Platform**: Unchanged — Node.js server/library runtime.

**Project Type**: Library — all changes within the existing `packages/telegram` package; no new
package.

**Performance Goals**: The oversized-message check and dedup lookup must both be O(1)/cheap —
this is inbound/outbound hot-path code, consistent with core's NFR-006 (no blocking I/O, minimal
overhead in the dispatch path).

**Constraints**: No new `ChatterError` subclass (FR-007/constitution Principle II — this is an
adapter-only change, not a core change). No new required constructor parameters (backward
compatible with ticket #2's existing `TelegramAccountConfig`/`TelegramAccountAdapterOptions`
call sites). Secrets still never appear in anything surfaced (FR-006).

**Scale/Scope**: Four small, independent behavioral additions to existing files
(`telegram-account-adapter.ts`, `telegram-webhook-handler.ts`, `map-telegram-error.ts`) plus one
documentation deliverable (manual verification checklist). No new files beyond a small dedup
helper and its test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does this add content interpretation? | PASS — dedup keys on `update_id` (a provider-assigned integer), not message content; nothing here inspects text meaning. |
| II. Adapter Isolation & Extensibility | Does this require modifying `@chatter/core`? | PASS — every change is internal to `packages/telegram`; core's `AccountAdapter` contract, types, and errors are used exactly as ticket #1 defined them. |
| III. Capabilities Over False Parity | Any capability change? | PASS — capability set (`text`, `reply`) is unchanged; this ticket doesn't touch capability declaration at all. |
| IV. Test-First, Contract-Tested | Tests before/alongside implementation? Conformance suite still passes unmodified? | PASS — tasks.md sequences tests first per story; the existing `conformance.spec.ts` is re-run, not modified, to confirm no regression. |
| V. Typed, Explicit Contracts | Uses only existing typed errors? | PASS — migration info and oversized-message rejection both route through the existing `ChatterInvalidTargetError`/`ChatterConfigurationError` types (see research.md), no new error class. |
| VI. Security & Privacy By Default | Bounded in-memory only? Secrets still never surfaced? | PASS — dedup window is bounded and non-durable (FR-002); the new cleanup-failure surfacing routes through the existing `mapTelegramError` sanitization before ever reaching a callback/log (FR-006). |
| VII. Independent Semantic Versioning | Does this stay within `@chatter/telegram`'s own versioning? | PASS — purely additive/internal changes to an existing 0.x package; no cross-package version implications. |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-telegram-hardening/
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
│   ├── dedup/
│   │   └── update-dedup-window.ts   # NEW — bounded in-memory Set<update_id>, FIFO eviction
│   ├── adapter/
│   │   └── telegram-account-adapter.ts   # MODIFIED — dedup check in dispatch path,
│   │                                     #   message-length pre-validation in send(),
│   │                                     #   cleanup-failure callback in stop()
│   ├── webhook/
│   │   └── telegram-webhook-handler.ts   # MODIFIED — passes update_id through for dedup
│   └── errors/
│       └── map-telegram-error.ts         # MODIFIED — migrate_to_chat_id surfaced in message
├── tests/
│   ├── unit/
│   │   ├── update-dedup-window.spec.ts   # NEW
│   │   ├── errors.spec.ts                 # EXTENDED — migration case
│   │   └── send-validation.spec.ts        # NEW — oversized-message rejection
│   ├── integration/
│   │   └── duplicate-delivery.spec.ts     # NEW
│   └── conformance.spec.ts                # UNCHANGED — re-run to confirm no regression
├── README.md                              # MODIFIED — documents dedup window bound, migration
│                                           #   surfacing, length limit, cleanup-failure hook
└── MANUAL-VERIFICATION.md                 # NEW — Story 5's human checklist
```

**Structure Decision**: Everything stays inside the existing `packages/telegram` package
established in ticket #2 — this is a hardening pass on one package, not a new component. The one
new small module (`dedup/update-dedup-window.ts`) is split out because it's a generically
reusable, independently-testable bounded-set primitive, not because it needs its own package.

## Complexity Tracking

*No constitution violations — table not applicable.*
