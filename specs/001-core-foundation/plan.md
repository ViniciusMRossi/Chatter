# Implementation Plan: Core Package Foundation

**Branch**: `001-core-foundation` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-core-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build `@chatter/core` (normalized types, adapter contract, orchestrator with start/stop
lifecycle, typed error hierarchy, delivery results) and `@chatter/testing` (fake in-memory
account implementation + a reusable adapter conformance suite), enabling a host application to
register one or more fake accounts and round-trip a normalized text message with zero real
provider involvement. This is the architecture-validating slice for the whole project; every
later provider adapter is built against the contract established here.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js active LTS.

**Primary Dependencies**: None beyond Node.js builtins for runtime code (`node:events` for the
orchestrator's inbound event emission). No HTTP framework, no provider SDKs — none are needed or
permitted in this phase per constitution Principle II.

**Storage**: N/A — no persistence anywhere in this phase (constitution Principle VI); the fake
account's message log is in-memory, unbounded only within a single test run, and exists purely
so tests can assert on what was sent.

**Testing**: Vitest, for both `@chatter/core` unit tests and the `@chatter/testing` conformance
suite (which itself is exercised, in this phase, only against the fake account).

**Target Platform**: Node.js server/library runtime (no browser target).

**Project Type**: Library — pnpm workspace monorepo, two packages this phase (`@chatter/core`,
`@chatter/testing`), more added in later tickets per the roadmap.

**Performance Goals**: Not a driver for this phase. Constitution Principle VI / NFR-006 (no
blocking I/O in the dispatch path) is satisfied structurally by having no I/O at all in this
phase — verified by inspection, not benchmarked.

**Constraints**: No network I/O, no filesystem I/O, no real provider SDK dependency anywhere in
`@chatter/core`. ESM-only build output. No default persistence of message content or participant
data (constitution Principle VI).

**Scale/Scope**: Two packages, roughly a dozen public types/classes, one fake account
implementation, one conformance suite. Scoped tightly to Phase 1 of the roadmap; deliberately
excludes every real provider adapter.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does this plan add content interpretation, an LLM call, prompt/context management, or memory ownership? | PASS — core only moves normalized data structures; no content is read for any purpose beyond pass-through. |
| II. Adapter Isolation & Extensibility | Does `@chatter/core` import any provider SDK? Can a third party implement an adapter without modifying core? | PASS — this phase has zero provider SDKs in the dependency tree; the adapter contract is defined entirely in `@chatter/core` and implemented by `@chatter/testing`'s fake account with no core changes required. |
| III. Capabilities Over False Parity | Does the design let an account under-declare features rather than faking them? | PASS — FR-007 requires a capability query; the fake account will declare a capability set explicitly (including a case where a capability is intentionally absent, to make Story 3 testable). |
| IV. Test-First, Contract-Tested | Are tests written before/alongside implementation? Is there a fake adapter + conformance suite testable without credentials? | PASS — this is the phase whose entire purpose is standing up the fake adapter and conformance suite (FR-011, FR-012, FR-013); tasks.md will sequence tests before/alongside each implementation unit. |
| V. Typed, Explicit Contracts | TypeScript strict mode? Typed error hierarchy per FR-008? Delivery results typed per FR-006? | PASS — see Technical Context and data-model.md; error hierarchy is a `ChatterError` base class with one subclass per FR-008 category, not a string/code union. |
| VI. Security & Privacy By Default | Any default persistence? Any secret logging risk? | PASS — no persistence, no secrets exist yet in this phase (fake account needs no credentials); revisit when a real adapter with real secrets is built. |
| VII. Independent Semantic Versioning | Does this phase set up independent package versioning? | PASS (structural) — `@chatter/core` and `@chatter/testing` are separate publishable packages from the first commit; actual version-range declarations become relevant once a second consumer package (an adapter) exists in a later ticket. |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-core-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── core/
│   ├── src/
│   │   ├── types/            # Provider, Account, Participant, Conversation, Message,
│   │   │                      # Event, Capability, DeliveryResult — normalized model
│   │   ├── errors/            # ChatterError base + one subclass per FR-008 category
│   │   ├── adapter/           # Adapter contract (interface + lifecycle types)
│   │   ├── orchestrator/       # Chatter class: register(), start(), stop(),
│   │   │                      # inbound event routing, outbound send routing
│   │   └── index.ts           # public package entrypoint (barrel export)
│   ├── tests/
│   │   ├── unit/               # normalization, routing, lifecycle, error tests
│   │   └── integration/        # multi-account round-trip tests via the fake account
│   ├── package.json
│   └── tsconfig.json
│
├── testing/
│   ├── src/
│   │   ├── fake-account/       # in-memory Account implementation satisfying the
│   │   │                      # @chatter/core adapter contract
│   │   ├── conformance/        # reusable conformance test suite, parameterized by
│   │   │                      # an account factory — not hardcoded to the fake account
│   │   └── index.ts
│   ├── tests/
│   │   └── conformance.spec.ts # runs the conformance suite against the fake account
│   ├── package.json
│   └── tsconfig.json
│
├── package.json          # workspace root (private, no publish)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.workspace.ts (or vitest config per package, see research.md)
```

**Structure Decision**: pnpm workspace with packages under `packages/<name>` (not
`packages/@chatter/<name>` — the npm scope is applied via each package's own `package.json`
`name` field, e.g. `"name": "@chatter/core"`, per the open decision in the roadmap that scope
naming is still provisional). Two packages this phase: `core` and `testing`. Provider adapter
packages (`slack`, `discord`, `telegram`, `whatsapp`) are added as sibling directories in later
tickets — this structure is chosen specifically so adding one never requires touching `core`'s
directory, mirroring constitution Principle II at the filesystem level.

## Complexity Tracking

*No constitution violations — table not applicable.*
