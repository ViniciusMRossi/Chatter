# Implementation Plan: Attachment Model in Core

**Branch**: `004-attachment-model` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-attachment-model/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Adds an `Attachment` type to `@chatter/core`, extends `Message` (inbound) and `SendInput`
(outbound) to carry one, adds a new `"attachments"` `Capability` value, and reuses the existing
`ChatterError` hierarchy (no new error types) for the two attachment-specific failure modes:
unsupported capability and oversized directly-supplied content. `@chatter/testing`'s
`FakeAccountAdapter` and `runAccountConformanceSuite` are extended to prove the contract, fully
provider-agnostic. No provider adapter is touched — that's the next ticket.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js active LTS — unchanged.

**Primary Dependencies**: None new. `Buffer` is a Node built-in, already used elsewhere in this
codebase (e.g. the example app).

**Storage**: N/A — attachments are represented by reference (a URL) or by directly-supplied
bytes passed through, never persisted by Chatter itself (constitution Principle VI, spec FR-009).

**Testing**: Vitest, against `@chatter/testing`'s extended `FakeAccountAdapter` and
`runAccountConformanceSuite` — no real provider, no network, consistent with every prior ticket.

**Target Platform**: Unchanged — Node.js library.

**Project Type**: Library — changes confined to `packages/core` and `packages/testing`; no new
package.

**Performance Goals**: Not a driver. The size-limit check (FR-007) is a synchronous
`Buffer.byteLength` comparison — trivially cheap, consistent with NFR-006 (no blocking I/O in
the dispatch path).

**Constraints**: No new `ChatterError` subclass (spec Requirements + constitution Principle V —
reuse `ChatterUnsupportedCapabilityError` and `ChatterConfigurationError`, exactly as ticket #1
and ticket #3 already established for their own capability/validation checks). `Message.attachments`
and `SendInput.attachment` are both purely additive/optional. One deliberate exception to
"no breaking change": `Message.text`/`SendInput.text` narrow from required to optional, since
FR-001 requires attachment-only messages (no caption) to be representable — see research.md. This
requires one mechanical compile-fix in `@chatter/telegram` (guarding a length check against
`undefined`) to keep the monorepo type-checking; it adds no attachment behavior to Telegram.

**Scale/Scope**: One new type file, three extended existing files in `@chatter/core`, and
extensions to two existing files in `@chatter/testing`. No new files in the test-support sense —
this reuses `FakeAccountAdapter`/`runAccountConformanceSuite` directly rather than adding
parallel infrastructure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does this interpret attachment content? | PASS — `Attachment` only carries metadata + a reference/bytes; nothing inspects, classifies, or transforms content. |
| II. Adapter Isolation & Extensibility | Does this require a provider adapter to exist? | PASS — this ticket is deliberately core-only; the Telegram adapter isn't touched, proving the contract stands on its own before any real provider implements it. |
| III. Capabilities Over False Parity | Is attachment support declared, not assumed? | PASS — the new `"attachments"` `Capability` value follows the exact declaration pattern `"reply"`/`"thread"` already established; an adapter that doesn't declare it must reject, not silently degrade. |
| IV. Test-First, Contract-Tested | Tests before/alongside implementation? Conformance suite extended, not bypassed? | PASS — tasks.md sequences fake-adapter and conformance-suite tests alongside each implementation unit; existing conformance checks for pre-attachment behavior are preserved unmodified. |
| V. Typed, Explicit Contracts | New error type introduced? | PASS (by avoidance) — reuses `ChatterUnsupportedCapabilityError`/`ChatterConfigurationError`; no new error class. |
| VI. Security & Privacy By Default | Any default persistence or automatic content fetch? | PASS — FR-009 explicitly forbids both; `Attachment` is reference/bytes-passthrough only. |
| VII. Independent Semantic Versioning | Breaking change to `@chatter/core`'s public API? | PASS — both new fields are optional; existing consumers (including `@chatter/telegram`, unaffected until its own ticket) keep working without modification. |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-attachment-model/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/core/
├── src/
│   ├── types/
│   │   ├── attachment.ts     # NEW — AttachmentKind, AttachmentSource, Attachment
│   │   ├── message.ts        # MODIFIED — Message.attachments?: readonly Attachment[]
│   │   ├── capability.ts     # MODIFIED — Capability gains "attachments"
│   │   └── index.ts          # MODIFIED — barrel export
│   └── adapter/
│       └── adapter.ts        # MODIFIED — SendInput.text optional, SendInput.attachment?: Attachment
├── src/orchestrator/
│   └── chatter.ts             # MODIFIED — Chatter.send() forwards input.attachment (see research.md)
├── tests/
│   ├── unit/                  # extended: attachment representation, capability value
│   └── integration/            # extended: round trip with attachment via fake adapter
└── src/index.ts               # MODIFIED — re-export Attachment types

packages/telegram/
└── src/adapter/
    └── telegram-account-adapter.ts # MODIFIED (mechanical only) — guard the existing 4096-char
                                     #   length check against input.text now being optional; NOT
                                     #   an attachment implementation (see research.md)

packages/testing/
├── src/
│   ├── fake-account/
│   │   └── fake-account-adapter.ts   # MODIFIED — attachment-aware send(), configurable
│   │                                 #   max size, "attachments" capability support
│   └── conformance/
│       └── conformance-suite.ts      # MODIFIED — new getTestAttachment config field +
│                                     #   two new conditional checks (supported / not)
└── tests/                            # extended: fake-adapter attachment behavior
```

**Structure Decision**: No new packages, no new top-level directories — this ticket is
deliberately additive within the two packages ticket #1 already established, matching its own
stated scope ("purely a core/contract ticket"). `packages/telegram` is untouched.

## Complexity Tracking

*No constitution violations — table not applicable.*
