# Implementation Plan: Message Edits and Deletions

**Branch**: `007-message-edits-deletions` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-message-edits-deletions/spec.md`

## Summary

Applications currently never learn that a received message changed — the Telegram adapter drops
`edited_message` updates entirely — and have no way to change or remove a message they sent.

This feature closes all three, and records the asymmetry between them. Inbound edits become a new
`"message.edited"` event carrying the message in its edited state with the same id it was first
delivered under. Outbound `editMessage` and `deleteMessage` join `send()` on the adapter contract,
capability-gated and typed-error-mapped. Inbound *deletions* are recorded as a deliberate
non-capability: Telegram reports them to bots not at all, so no capability is offered that an
adapter could only declare falsely.

The enabling change is at the adapter boundary: `start()`'s dispatch callback goes from carrying a
bare message to carrying a tagged `InboundEvent`. That is a breaking change to `AccountAdapter`,
taken now rather than absorbed as a second optional callback, because reactions would otherwise
force a third.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, ESM-only output

**Primary Dependencies**: `grammy` + `@grammyjs/types` (Telegram adapter only; core imports no
provider SDK, per Principle II). No new runtime dependency is introduced by this feature.

**Storage**: None. Deliberately — FR-005 and Principle VI forbid retaining message content, which
is what makes "previous content" unavailable by design rather than by omission.

**Testing**: Vitest. Bruno for executable API documentation of the webhook surface.

**Target Platform**: Node.js active LTS. Library, consumed by host applications.

**Project Type**: pnpm monorepo of independently versioned libraries — `@chatter/core`,
`@chatter/telegram`, `@chatter/testing`.

**Performance Goals**: Not latency-driven. One relevant cost is introduced and bounded: editing an
attachment caption takes two Telegram round trips rather than one (research D6). Editing text, the
common case, remains one.

**Constraints**:
- No message content or history may be persisted, in memory or otherwise (Principle VI, FR-005).
- Provider time limits must not be pre-judged against a local clock (FR-021).
- A never-edited message must keep byte-identical shape to before this feature (FR-007, SC-002).
- Existing consumers must not observe edits through their `message.created` handlers (FR-002).

**Scale/Scope**: 3 packages, 2 adapter implementations (Telegram + fake), 1 conformance suite.
Current baseline: core 20 tests, testing 35, telegram 103, Bruno 18 requests / 22 tests.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design.*

| Principle | Assessment | Verdict |
|---|---|---|
| **I. Transport-Only Boundary** | No content interpretation added. FR-005 actively *enforces* the boundary by refusing to carry previous content, and FR-020 refuses to reinterpret a provider rejection as success. The one place the feature touches interpretation — deciding text vs caption — is resolved by asking the provider rather than by inspecting content (D6). | **PASS** |
| **II. Adapter Isolation** | Core gains `InboundEvent`, `EditInput`, `DeleteInput`, three capabilities, and `Message.editedAt` — no provider types, no provider SDK import. A third-party adapter can implement all of it without modifying core. | **PASS** |
| **III. Capabilities Over False Parity** | The strongest case in the feature. Three capabilities are declared independently (FR-018), and inbound deletion is refused a capability precisely *because* no adapter could honor it (FR-012). No simulation via polling or diffing (FR-013). | **PASS** |
| **IV. Test-First, Contract-Tested** | Conformance suite gains general inbound emission (D4) plus edit and outbound-failure checks (FR-025, FR-026). The fake adapter implements every new capability (FR-027), so all of it is verifiable without credentials. Tests precede code per the workflow rule. | **PASS** |
| **V. Typed, Explicit Contracts** | All additions are typed; both outbound operations map failures onto the existing categorized hierarchy (FR-019), including the FR-020 case resolved to `ChatterConfigurationError` by established precedent (D2). No new generic `Error` is thrown. | **PASS** |
| **VI. Security & Privacy By Default** | No new secret handling, no new logging, no persistence. Webhook signature validation is untouched and still precedes all parsing. The new update branch sits *after* the existing secret check, inheriting it. | **PASS** |
| **VII. Independent Semantic Versioning** | **Requires justification.** `AccountAdapter.start()` changes shape — a breaking change to the adapter contract. See Complexity Tracking. | **PASS with justification** |

**Post-Phase-1 re-evaluation**: no verdict changed. The design in `data-model.md` and `contracts/`
introduces no provider coupling in core, no persistence, and no new error category. The only gate
requiring justification remains VII, unchanged in nature and scope.

**Tier 2 security assessment**: not warranted. No auth, payments, or data-boundary changes. The
outbound operations act on message ids the caller already holds, under the provider's own
authorization model (deliberately not reimplemented — see spec Assumptions). Flagged for human
judgment, not decided here, per the constitution's Development Workflow.

## Project Structure

### Documentation (this feature)

```text
specs/007-message-edits-deletions/
├── plan.md              # This file
├── research.md          # Phase 0 output — D1..D10
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── inbound-events.md    # Phase 1 — adapter dispatch + public event contract
│   └── outbound-ops.md      # Phase 1 — editMessage / deleteMessage contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (16/16)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/core/src/
├── types/
│   ├── capability.ts        # + "editNotifications" | "editMessage" | "deleteMessage"
│   ├── message.ts           # + editedAt?: Date
│   └── event.ts             # + MessageEditedEvent; ChatterEvent becomes a real union
├── adapter/
│   └── adapter.ts           # InboundEvent; start() signature; EditInput/DeleteInput;
│                            #   optional editMessage()/deleteMessage()
└── orchestrator/
    └── chatter.ts           # dispatch tagged events; capability-gated edit/delete;
                             #   "message.edited" in the public event map

packages/telegram/src/
├── adapter/telegram-account-adapter.ts   # declare 3 capabilities; editMessage/deleteMessage;
│                                         #   dispatch tagged events
├── errors/map-telegram-error.ts          # edit-scoped "message is not modified" mapping
├── mapping/message.ts                    # + editedAt from edit_date
└── webhook/telegram-webhook-handler.ts   # handle update.edited_message

packages/testing/src/
├── conformance/conformance-suite.ts      # emitInbound(adapter, scenario); edit + outbound checks
└── fake-account/fake-account-adapter.ts  # implement all three new capabilities

bruno/telegram-adapter/local-webhook/     # executable coverage for the edit update path
```

**Structure Decision**: unchanged from prior features — the established three-package monorepo
layout. This feature adds no new package and no new directory; every file above already exists.
That is a deliberate signal: edits and deletions are extensions of the existing contract, not a
parallel mechanism.

## Implementation Sequence

Ordered so each step is independently green and reviewable, per the constitution's
tests → code → passing tests → documentation rule.

1. **Core model** — `Message.editedAt`, three capabilities, `MessageEditedEvent`. Purely additive;
   all existing tests must pass untouched.
2. **Adapter contract** — `InboundEvent`, the `start()` signature change, `EditInput`/`DeleteInput`,
   optional outbound methods. Breaking; updates both in-repo adapters in the same commit so the
   workspace never sits red.
3. **Orchestrator** — tagged dispatch, `"message.edited"` in the public event map, capability gates
   for both outbound operations.
4. **Conformance suite + fake adapter** — generalized `emitInbound` hook, edit checks, outbound
   failure checks. Written before the Telegram work so the Telegram adapter is held to a contract
   that already exists.
5. **Telegram inbound** — `edited_message` in the webhook handler, `editedAt` in `mapMessage`,
   plus the FR-009 dedup regression test.
6. **Telegram outbound** — `editMessage` with the caption fallback (D6), `deleteMessage`, and the
   edit-scoped error mapping (D2).
7. **Documentation** — package READMEs and Bruno coverage, including the FR-012 non-capability
   written down where a reader will actually meet it.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Breaking change to `AccountAdapter.start()` (Principle VII — requires a version bump and a compatibility declaration) | FR-002 requires edits to arrive as a distinct kind, and FR-023 requires the mechanism to be general rather than per-feature. The current callback carries a bare `InboundMessage` and can express exactly one thing happening, so there is nowhere for a second inbound kind to go. | Adding a second optional callback (`start(dispatch, onEdit?)`) is fully backward compatible and was rejected *because* of that: it is the shape that makes the problem permanent — reactions add a third parameter, and FR-023 exists specifically to stop this accretion. Widening the parameter to a union keeps old adapters compiling but leaves two ways to express "message created" forever. Blast radius is two in-repo implementations; every package is at `0.1.0` with `workspace:*` deps and nothing is published, so the migration cost is paid entirely inside this PR. |

**Versioning consequence**: `@chatter/core` `0.1.0` → `0.2.0`; `@chatter/telegram` and
`@chatter/testing` follow, declaring compatibility with `^0.2.0`. Under 0.x semver a minor bump is
the correct vehicle for a breaking change. Per Principle VII the adapter packages must state the
core range they are compatible with — currently `workspace:*`, which must become explicit before
any of these are published. Flagged, not fixed here: making it explicit is a release-engineering
task affecting all packages, not a change this feature should make unilaterally.
