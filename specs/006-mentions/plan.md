# Implementation Plan: Mentions

**Branch**: `006-mentions` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-mentions/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Adds a normalized `Mention` to `@chatter/core` — literal text, UTF-16 offset/length, an optional
`Participant` (present only when the provider resolves one), and a required `isSelf` flag — exposed
as `Message.mentions?: readonly Mention[]`, plus a `"mentions"` `Capability`. `@chatter/telegram`
maps Telegram's two mention entity kinds onto it: `text_mention` (carries a full `User`) becomes a
resolved mention via the existing `mapParticipant`; `mention` (`@handle` only, no user id) becomes
an unresolved mention carrying text and position but no participant. `bot_command` is deliberately
not a mention (FR-017). Self-detection compares the resolved user id against the bot's own id, and
the `@handle` text case-insensitively against the bot's own username — the latter requiring
`start()` to also capture `me.username`, alongside the `me.id` it already stores.

The single most load-bearing detail: Telegram entity offsets are **UTF-16 code units**, which is
exactly JS's native string indexing, so `text.slice(offset, offset + length)` is correct as written
and needs no code-point conversion — but only if offsets are applied to the same string the message
exposes as `text`. Since `mapMessage` already collapses `caption` and `text` into one `text` field,
the caption entity array must be selected in lockstep with that same choice, or every offset in a
captioned message silently points into the wrong string.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js >= 22 — unchanged from prior tickets.

**Primary Dependencies**: None new. `@grammyjs/types` (v4.0.0) already supplies `MessageEntity` and
`User`; no grammY API surface beyond the `getMe()` call `start()` already makes.

**Storage**: N/A — no persistence. Mentions are pass-through message metadata, subject to the same
no-persist/no-log posture as message content (constitution Principle VI).

**Testing**: Vitest against the existing `StubTelegramTransport` harness. Unlike ticket #5, this
ticket needs **no** new stub-transport capability: mention data arrives entirely inside the inbound
webhook payload, and the one outbound call involved (`getMe`) is already stubbed. The bot username
must become settable on the stub's `getMe` response, which the harness's existing queueable-response
mechanism already covers.

**Target Platform**: Node.js server/library runtime — unchanged.

**Project Type**: Library monorepo. This ticket touches three packages: `@chatter/core` (additive
types), `@chatter/testing` (fake adapter + conformance), `@chatter/telegram` (mapping + adapter).

**Performance Goals**: Not a driver. Mention mapping is a single linear pass over an entity array
that is almost always empty and is bounded by the provider's own message-length limit. No new
network calls — `getMe()` is already made once at start, and this ticket reads one more field off
its existing response rather than issuing a second call.

**Constraints**: No new `ChatterError` subclass (Principle V) — malformed provider entities are
skipped rather than thrown (FR-015), reusing the existing `reportNonFatalError` channel already used
for inbound mapping failures. Core must not learn anything Telegram-specific (Principle II): the
`Mention` shape is expressed in provider-neutral terms, and the fact that one Telegram entity kind
is unresolvable is a Telegram mapping detail, not a core concept.

**Scale/Scope**: Three new files (`core/src/types/mention.ts`, `telegram/src/mapping/mention.ts`,
plus a unit spec), and modifications to `core/src/types/message.ts`, `core/src/types/capability.ts`,
`core/src/types/index.ts`, `telegram/src/mapping/message.ts`, `telegram/src/adapter/
telegram-account-adapter.ts`, `testing/src/fake-account/fake-account-adapter.ts`,
`testing/src/conformance/conformance-suite.ts`, plus Bruno collection additions and README updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does deciding "who was mentioned" interpret content? | PASS — and this was the gate that shaped the design. Mentions are read **only** from provider-supplied entity structure (FR-014); Chatter never scans text for `@`-patterns. This is precisely why FR-017 rejects synthesizing a mention from `/command@botname`: the provider labelled that a command, not a person reference, and inferring otherwise would be Chatter interpreting content. Comparing a resolved id against the connected account's own id is identity *self*-recognition within one provider, not cross-provider identity merging. |
| II. Adapter Isolation & Extensibility | Does core gain provider-specific knowledge? | PASS — core gains `Mention`/`"mentions"` expressed neutrally. "Some mentions carry no participant" is a general provider reality (Slack's `@here`-style and unresolvable handles behave alike), not a Telegram carve-out. No provider SDK or type reaches core. |
| III. Capabilities Over False Parity | Is mention support declared honestly? | PASS — `"mentions"` is added to the Telegram adapter's `CAPABILITIES` only once inbound mapping genuinely works, and the fake adapter gains a way to be constructed *without* it so the negative branch is exercised rather than assumed. |
| IV. Test-First, Contract-Tested | Tests before implementation? Conformance genuinely exercised? | PASS — tasks.md sequences each test ahead of its implementation. Note the real gap this ticket must close: the existing conformance suite is **entirely `send()`-oriented**, so it cannot currently test an inbound-only feature at all. This ticket extends `ConformanceSuiteConfig` with an inbound-emission hook so mention conformance is genuinely adapter-agnostic rather than a Telegram-only unit test wearing a conformance label. |
| V. Typed, Explicit Contracts | New error type? Untyped failure modes? | PASS (by avoidance) — no new error class. Malformed entities are skipped and surfaced through the existing non-fatal error channel; FR-018's failure path reuses the `ChatterAuthenticationError` that `start()` already throws. |
| VI. Security & Privacy By Default | New sensitive data exposure? | PASS — mentions carry display names and handles already present in message content the adapter passes through today. Nothing new is persisted or logged. The bot's own username, newly retained in memory, is public information, not a secret, and is never logged alongside the token. |
| VII. Independent Semantic Versioning | Breaking change? | PASS — every change is additive: a new optional `Message` field, a new `Capability` union member, a new optional `ConformanceSuiteConfig` field. `Capability` widening is technically observable to an exhaustive `switch` in consumer code, which is why FR-002 keeps `mentions` optional-and-absent rather than always-present-and-empty. |

**Gate result**: PASS, no violations to justify. Complexity Tracking section omitted accordingly.

## Project Structure

### Documentation (this feature)

```text
specs/006-mentions/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── mention-contract.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/core/src/types/
├── mention.ts               # NEW — Mention interface
├── message.ts               # MODIFIED — mentions?: readonly Mention[]
├── capability.ts            # MODIFIED — adds "mentions"
└── index.ts                 # MODIFIED — re-export

packages/testing/src/
├── fake-account/fake-account-adapter.ts   # MODIFIED — emit mentions, optional capability
└── conformance/conformance-suite.ts       # MODIFIED — inbound hook + mention checks

packages/telegram/src/
├── mapping/mention.ts       # NEW — entity array -> readonly Mention[]
├── mapping/message.ts       # MODIFIED — select entities in lockstep with text/caption
└── adapter/telegram-account-adapter.ts    # MODIFIED — capture me.username, declare capability

packages/telegram/tests/
├── unit/mention-mapping.spec.ts           # NEW
└── integration/mention-round-trip.spec.ts # NEW

bruno/telegram-adapter/local-webhook/
├── mention-message.yml                    # NEW — @handle + text_mention entities
├── bot-command-not-a-mention.yml          # NEW — asserts FR-017
└── check-received-count-after-mentions.yml # NEW
```

**Structure Decision**: No new package. Changes land in the three existing packages above,
following the same core-defines / testing-verifies / telegram-implements split established by
tickets #4 and #5 (attachment model, then its Telegram mapping) — except that this ticket does both
halves in one pass, since the core surface is small enough that splitting it would produce a core
release nothing consumes.

## Bruno / API documentation obligation

**Required — yes.** Per AGENTS.md, an inbound webhook endpoint change obligates a same-PR Bruno
update. This ticket does not alter the endpoint's URL, method, or auth, but it does change what the
endpoint meaningfully accepts and how it behaves: an update carrying `entities` now produces
materially different output. `bruno/telegram-adapter/local-webhook/` is already the CI-wired,
credential-free folder covering exactly this class of payload variation (direct, group, photo,
document, voice), and it runs via `packages/telegram/tests/bruno/run.sh` against the stub-backed
test server. Three requests are added there with `tests` blocks, following the existing
`photo-message.yml` + `check-received-count-after-media.yml` pairing convention.

No change is needed under `bruno/telegram-adapter/telegram-bot-api/` — `get-me.yml` already
documents the only outbound call involved, and this ticket reads an additional field from its
existing response rather than changing the request.
