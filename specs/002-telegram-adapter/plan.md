# Implementation Plan: Telegram Provider Adapter

**Branch**: `002-telegram-adapter` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-telegram-adapter/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build `@chatter/telegram`, the first real provider adapter, implementing `@chatter/core`'s
`AccountAdapter` contract on top of Telegram's Bot API via grammY, using a webhook transport.
Normalizes direct and group chats, maps Telegram-specific failures onto the ticket #1 typed
error hierarchy, declares an accurate (text + reply, no thread) capability set, passes the
existing adapter conformance suite unmodified, and ships a Telegram-backed example app proving
the same host application code works identically across both conversation types — the Phase 2
roadmap exit criterion.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js active LTS — unchanged from ticket #1.

**Primary Dependencies**: `grammy` (Telegram Bot API client + typed Update payloads + framework-
neutral `webhookCallback()` helper). `@chatter/core` as a workspace dependency (the contract this
adapter implements). No other new runtime dependencies.

**Storage**: N/A — no persistence, consistent with constitution Principle VI. Bot token and
webhook secret live only in the adapter instance's memory for the process lifetime.

**Testing**: Vitest, consistent with the rest of the workspace. Non-live unit/integration tests
exercise chat-type mapping, error mapping, and webhook secret validation entirely against
synthetic `Update` payloads and a stubbed HTTP transport — no real network call to Telegram in
the automated suite (FR-010, NFR-009). The adapter is additionally run through
`@chatter/testing`'s `runAccountConformanceSuite` unmodified (FR-009).

**Target Platform**: Node.js server/library runtime; the webhook handler itself is Fetch API
`Request -> Promise<Response>` shaped, so it's embeddable in any HTTP framework or Node's raw
`http` module via a thin adapter (documented, not shipped as separate framework packages).

**Project Type**: Library — new sibling package `packages/telegram` in the existing pnpm
workspace, plus a non-package example app at `example-apps/telegram-echo` (outside `packages/`,
not published).

**Performance Goals**: Not a driver for this ticket. Webhook request handling must not block on
anything beyond the outbound Telegram API calls it legitimately needs to make.

**Constraints**: Zero changes to `@chatter/core` (constitution Principle II). Bot token and
webhook secret must never appear in thrown error messages or logs at any level (NFR-004,
spec FR-001) — this means wrapping/sanitizing grammY's own errors at the adapter boundary rather
than letting them propagate raw, since a raw HTTP-client error can include the request URL
(which contains the bot token, per Telegram's `https://api.telegram.org/bot<TOKEN>/...` URL
scheme).

**Scale/Scope**: One new package, roughly: chat/participant/message mapping, an outbound send
client wrapper, a webhook handler with secret validation, an error-mapping layer, and one example
app. Deliberately excludes every other provider (Slack/Discord/WhatsApp — later tickets) and every
non-text capability (Phase 5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Transport-Only Boundary | Does this adapter interpret message content for any purpose beyond pass-through? | PASS — text is normalized and passed through only; no classification, no LLM calls. |
| II. Adapter Isolation & Extensibility | Does this ticket require modifying `@chatter/core`? | PASS — `@chatter/telegram` implements the existing `AccountAdapter` contract exactly as ticket #1 defined it; no core changes needed or planned. |
| III. Capabilities Over False Parity | Does the adapter declare only what it actually supports? | PASS — declares `text` and `reply`; does not declare `thread` (Telegram topics are out of scope), satisfying FR-007 and Story 4 AC4. |
| IV. Test-First, Contract-Tested | Tests before/alongside implementation? Conformance suite unmodified? | PASS — tasks.md will sequence synthetic-payload tests alongside each implementation unit; `runAccountConformanceSuite` is imported unmodified from `@chatter/testing` per FR-009. |
| V. Typed, Explicit Contracts | Reuses ticket #1's error hierarchy? | PASS — see Technical Context error-mapping table in research.md; no new error classes introduced, only mapping logic. |
| VI. Security & Privacy By Default | Secrets never logged? Signature/secret validation before dispatch? | PASS — webhook secret validated via timing-safe comparison before any grammY parsing or dispatch (FR-003); token/secret sanitized out of all thrown errors (FR-001). No default persistence. |
| VII. Independent Semantic Versioning | Package versioned independently, declares core compatibility? | PASS — `packages/telegram/package.json` is a separate publishable package depending on `@chatter/core` via `workspace:*` locally and will declare a semver-range peer/dependency once versioning stabilizes past 0.x, consistent with ticket #1's packages. |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-telegram-adapter/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── core/                 # unchanged (ticket #1)
├── testing/               # unchanged (ticket #1) — runAccountConformanceSuite consumed as-is
│
└── telegram/
    ├── src/
    │   ├── config/         # bot token + webhook secret config type, validation
    │   ├── mapping/         # Telegram Update/Chat/User -> Chatter Message/Conversation/
    │   │                    # Participant mapping; chat.type -> ConversationType mapping
    │   ├── errors/          # Telegram Bot API error -> ChatterError subclass mapping
    │   ├── webhook/          # secret-token validation + Request -> Response handler,
    │   │                    # wrapping grammY's webhookCallback()
    │   ├── adapter/          # TelegramAccountAdapter implementing @chatter/core's
    │   │                    # AccountAdapter (start/stop/send/getCapabilities)
    │   └── index.ts          # public package entrypoint (barrel export)
    ├── tests/
    │   ├── unit/              # chat-type mapping, error mapping, secret validation
    │   ├── integration/        # synthetic-Update round trip through the adapter,
    │   │                      # stubbed outbound transport
    │   └── conformance.spec.ts # runs @chatter/testing's suite against this adapter
    ├── package.json
    ├── tsconfig.json
    └── README.md              # setup docs per FR-011 / NFR-011

example-apps/
└── telegram-echo/
    ├── src/index.ts          # same handler shape as ticket #1's illustrative example,
    │                        # wired to @chatter/telegram + a minimal Node http server
    │                        # exposing the webhook handler
    ├── package.json
    ├── tsconfig.json
    └── README.md              # how to run it against a real bot + tunnel
```

**Structure Decision**: `packages/telegram` follows the exact same shape as `packages/core` and
`packages/testing` from ticket #1 (own `package.json`/`tsconfig.json`/`vitest.config.ts`,
composite TS project reference to `../core`). The example app lives outside `packages/` in a new
top-level `example-apps/` directory since it is explicitly not a publishable library package —
this mirrors the product requirements doc's "one example application" MVP item without
conflating it with the adapter package itself.

## Complexity Tracking

*No constitution violations — table not applicable.*
