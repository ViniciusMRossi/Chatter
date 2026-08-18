# Phase 0 Research: Attachment Model in Core

## Decision: `Attachment` shape and where it lives

**Decision**: New file `packages/core/src/types/attachment.ts`:

```ts
export type AttachmentKind = "image" | "video" | "file";

export type AttachmentSource = { readonly url: string } | { readonly data: Buffer };

export interface Attachment {
  readonly kind: AttachmentKind;
  readonly source: AttachmentSource;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}
```

**Rationale**: A single shared type serves both directions (inbound on `Message`, outbound on
`SendInput`), matching the plan's design decision and the spec's Key Entities section, which
describes one `Attachment` concept rather than two. `AttachmentSource` as a two-member union
(`{url}` / `{data}`) directly represents FR-003 (inbound is always a resolved URL) and FR-004
(outbound is either a remote reference or directly-supplied content) without a discriminant tag —
`"url" in source` is enough to distinguish them at the one call site (the fake adapter's size
check) that needs to. By convention, adapters constructing inbound `Message.attachments` only
ever populate the `{url}` variant; this is documented via a doc comment on `Attachment` rather
than enforced with two separate types, matching this codebase's existing preference for the
smallest workable contract over maximal type-level enforcement (e.g. `InboundMessage` is already
expressed as `Omit<Message, "account">`, not a bespoke parallel hierarchy).

**Alternatives considered**:
- *Two separate types* (`InboundAttachment` with `source: { url: string }` only, and
  `OutboundAttachment` with the union) — more type-safe (an adapter could never accidentally
  construct an inbound message with `{data}`), but doubles the field list (kind/fileName/
  mimeType/sizeBytes) across two interfaces for a distinction only the fake adapter's internal
  size check currently cares about. Rejected as premature for a ticket whose own Assumptions
  section says to keep the model deliberately small.
- *Discriminated union with an explicit tag* (`{ type: "url"; url: string } | { type: "data";
  data: Buffer }`) — more explicit at the call site, but adds a redundant tag field where
  presence-of-`url`-vs-`data` is already unambiguous. Rejected as unnecessary ceremony.

## Decision: `Message.attachments` field shape

**Decision**: `readonly attachments?: readonly Attachment[]` on `Message` — optional, omitted or
empty both mean "no attachments."

**Rationale**: Matches the existing optional-field convention on `Message`
(`replyToMessageId?: string`) and, critically, keeps this a non-breaking addition — every
existing call site across tickets #1-#3 (fake adapter tests, Telegram mapping, the example app)
that constructs a `Message` without an `attachments` field keeps compiling unchanged, satisfying
constitution Principle VII (independent semver — no breaking change) and the spec's edge case
"an existing pre-attachment implementation... must continue to pass exactly as before."

**Alternatives considered**: A required `attachments: readonly Attachment[]` field defaulting to
`[]` was considered (avoids `attachments?.length` null-checking at every call site) but rejected
because it would force an otherwise-unrelated edit to every existing `Message`-construction call
site in the codebase, for a ticket whose own scope is explicitly "purely a core/contract ticket."

## Decision: `SendInput.attachment` field shape

**Decision**: `readonly attachment?: Attachment` (singular) on `SendInput`.

**Rationale**: Directly implements FR-004 ("at most one attachment per call") and User Story 2's
Acceptance Scenario 3. Singular naming (`attachment`, not `attachments`) makes the one-per-call
constraint self-documenting at the type level — there is no array to (incorrectly) push a second
item into.

## Decision: New `Capability` value

**Decision**: Add `"attachments"` to the `Capability` union in `packages/core/src/types/
capability.ts`: `export type Capability = "text" | "reply" | "thread" | "attachments";`

**Rationale**: Directly implements FR-005, following the exact declaration pattern already used
for `"reply"` and `"thread"` — a single value, not per-kind (`"attachments:image"` etc.), matching
the plan's rationale that per-media-type capability granularity would be premature (no adapter
today has partial media support to express).

## Decision: Error mapping — no new error types

**Decision**: Reuse existing `ChatterUnsupportedCapabilityError` (FR-006 — send with attachment
against a non-declaring account) and `ChatterConfigurationError` (FR-007 — oversized
directly-supplied attachment). No new subclass of `ChatterError`.

**Rationale**: Directly required by the spec's Requirements and constitution Principle V, and
mirrors precedent exactly: ticket #1 already uses `ChatterUnsupportedCapabilityError` for
unsupported `replyToMessageId`-via-thread targeting, and ticket #3 already uses
`ChatterConfigurationError` for Telegram's outbound text-length limit. Both existing error
classes already carry a `message` field sufficient to describe an attachment-specific failure
without any structural change to the error hierarchy itself.

## Decision: Where the capability/size checks live

**Decision**: Both checks are the responsibility of each individual `AccountAdapter`
implementation's own `send()` method (starting with `FakeAccountAdapter` in this ticket) — not
`Chatter.send()` in the orchestrator.

**Rationale**: Matches existing precedent exactly: capability-driven validation (e.g. rejecting
`replyToMessageId` targeting against an adapter that doesn't declare `"thread"`) already happens
inside adapter implementations today, not in the core orchestrator, since size limits and exact
capability nuances are adapter-specific knowledge core has no business encoding centrally
(constitution Principle II — core has zero provider-specific knowledge; a hardcoded central size
limit would be exactly that kind of leak, just from a different direction). `Chatter.send()`
itself requires no changes in this ticket.

## Decision: Size-limit check scope

**Decision**: The size check (FR-007) applies only when `attachment.source` has a `data` (Buffer)
variant — `data.byteLength` compared directly against a configurable limit. A `{url}`-sourced
attachment is never subject to this client-side check (matches spec Edge Cases: remote-content
size "is only discoverable once a provider processes it," out of scope for this ticket).

**Rationale**: `Attachment.sizeBytes` is documented as optional descriptive metadata (useful for
inbound attachments where Chatter never holds the bytes at all), not a value the size check
should trust for validation — the actual byte length of directly-supplied content is always
knowable and authoritative from the `Buffer` itself, so the check uses that, never the
possibly-absent-or-stale `sizeBytes` field.

## Decision: `FakeAccountAdapter` test-configuration surface

**Decision**: `FakeAccountAdapter`'s existing constructor config gains one new optional field,
`maxAttachmentSizeBytes?: number` — when set, `send()` rejects a `{data}` attachment whose
`byteLength` exceeds it with `ChatterConfigurationError`, before recording the send or returning
a result. When unset, no size check runs (matches spec Edge Case: "no size check applies" when an
account has no known limit).

**Rationale**: Mirrors the existing `capabilities?` constructor-config pattern from ticket #1
precisely (also an optional field with a permissive default). Gives conformance-suite tests and
this ticket's own unit tests a way to exercise FR-007 without needing a real provider's actual
size limit.

## Decision: `text` becomes optional on `Message` and `SendInput`

**Decision**: `Message.text: string` becomes `Message.text?: string`, and `SendInput.text: string`
becomes `SendInput.text?: string`.

**Rationale**: Discovered while cross-checking the design against the actual current source
(`packages/core/src/types/message.ts`, `packages/core/src/adapter/adapter.ts`): both fields are
`string`-required today, which makes "attachment-only, no text" (FR-001, User Story 1 Scenario 2,
User Story 2 Scenario 2's "no caption") structurally unrepresentable no matter what `Attachment`
itself looks like. This was missed in the original spec-writing pass because neither ticket #1
nor #2 had a reason to question a text-only model's text field being required. Fixing it is
required to satisfy FR-001, not optional polish.

**Consequences acknowledged**:
- This is a genuine breaking change to `@chatter/core`'s public API (narrows what's guaranteed
  about `message.text`/`input.text` for existing consumers), unlike every other change in this
  ticket. It's accepted because FR-001 cannot be satisfied without it, and `@chatter/core` has not
  yet reached a stable 1.0 (semver allows this pre-1.0; documented here rather than silently
  glossed over).
- `@chatter/telegram`'s `TelegramAccountAdapter.send()` currently does `input.text.length` (a
  4096-character limit check, ticket #3) unconditionally — this stops compiling once `text` is
  optional. Fixing this one line (guard for `undefined`, skip the length check when there's no
  text) is a mechanical compile-fix required to keep the monorepo type-checking as a whole; it is
  NOT attachment support in Telegram (Telegram still can't send or receive attachments after this
  ticket) and does not touch `getCapabilities()` or any send/receive behavior beyond the text
  guard itself. Tracked in tasks.md as an explicit, narrowly-scoped Polish task.
- `Chatter.send()` (`packages/core/src/orchestrator/chatter.ts`) currently builds the adapter-facing
  `SendInput` by hand, field by field, and does not yet forward an `attachment`. It must be
  updated to pass `input.attachment` through (mirroring the existing conditional-spread pattern
  already used there for `replyToMessageId`) — without this, `Chatter.send()` would silently drop
  any attachment even though the type system allows passing one in. This file was missing from
  plan.md's Project Structure section and has been added.

## Decision: Conformance suite extension shape

**Decision**: `ConformanceSuiteConfig` (in `@chatter/testing`) gains one new required field:
`getTestAttachment: () => Attachment` — returns a small, valid attachment (a few bytes of
`{data}`) for use by two new conditional checks, added alongside the existing thread-capability
checks:
- if `capabilities.has("attachments")`: assert a send with `getTestAttachment()` succeeds and
  returns a delivery result of the same shape as a text-only send.
- if not: assert the same send rejects with `ChatterUnsupportedCapabilityError`.

**Rationale**: Directly implements FR-008 and User Story 5, mirroring the existing pattern used
for the `"thread"` capability's own conditional pass/reject checks in the same suite — proven
adapter-agnostic infrastructure, not new machinery. Adding it as a required config field (like
`getKnownConversation`) rather than optional keeps the suite's own guarantee airtight: no future
adapter can silently skip attachment conformance simply by omitting a callback.
