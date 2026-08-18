# Data Model: Attachment Model in Core

## `AttachmentKind`

```ts
export type AttachmentKind = "image" | "video" | "file";
```

A small, closed set — deliberately not an open-ended MIME-type taxonomy (spec Assumptions).
`"file"` is the catch-all for anything that isn't an image or video.

## `AttachmentSource`

```ts
export type AttachmentSource = { readonly url: string } | { readonly data: Buffer };
```

| Variant | Used for | Notes |
|---|---|---|
| `{ url: string }` | Inbound (always); outbound (reference to existing remote content) | Inbound: a ready-to-use, adapter-resolved download reference (FR-003) — never a provider-specific opaque ID. Outbound: the adapter hands this to the provider without moving bytes through Chatter. |
| `{ data: Buffer }` | Outbound only | Directly-supplied local content the application wants uploaded. Subject to the size check in FakeAccountAdapter (FR-007) when a limit is configured. |

## `Attachment`

```ts
export interface Attachment {
  readonly kind: AttachmentKind;
  readonly source: AttachmentSource;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}
```

| Field | Required | Notes |
|---|---|---|
| `kind` | yes | One of `AttachmentKind`. |
| `source` | yes | One of `AttachmentSource`. |
| `fileName` | no | FR-002: none of filename/MIME type/size are required. |
| `mimeType` | no | Same. |
| `sizeBytes` | no | Descriptive metadata only — not authoritative for the FR-007 size check against a `{data}` source, which uses `data.byteLength` directly (see research.md). |

**Validation rules**: None enforced at the type level beyond TypeScript's own structural typing
— `kind` and `source` are the only required fields, matching FR-002 exactly. No runtime
validation function is introduced by this ticket; adapters and the fake adapter perform their own
capability/size checks as described below, but nothing validates, e.g., that `mimeType` is a
well-formed MIME string. That's out of scope (Chatter remains transport-only, FR-009).

**State transitions**: None — `Attachment` is an immutable value (all fields `readonly`),
constructed once by an adapter (inbound) or an application (outbound) and never mutated.

## `Message` (extended)

Adds one new optional field to the existing type in `packages/core/src/types/message.ts`:

```ts
readonly attachments?: readonly Attachment[];
```

- Omitted or empty array both mean "no attachments" — no semantic difference is assigned to one
  vs. the other.
- Every existing required/optional field on `Message` is unchanged (non-breaking addition, per
  research.md).

## `SendInput` (extended)

Adds one new optional field to the existing type in `packages/core/src/adapter/adapter.ts`:

```ts
readonly attachment?: Attachment;
```

- Singular — at most one per call (FR-004). Not an array; there is nothing to validate a "max
  length of 1" against because the type itself only allows zero or one.
- `text` remains optional and independent — `{ attachment }` alone (no `text`), `{ text }` alone
  (no `attachment`), and `{ text, attachment }` are all valid, matching User Story 1 Scenario 2's
  "an attachment does not require a caption."

## `Capability` (extended)

```ts
export type Capability = "text" | "reply" | "thread" | "attachments";
```

One new closed-set value, `"attachments"`, following the existing `"reply"`/`"thread"` pattern
exactly (FR-005).

## Relationships

```text
Message 1 ── 0..* → Attachment   (inbound; via Message.attachments)
SendInput 1 ── 0..1 → Attachment  (outbound; via SendInput.attachment)
AccountAdapter.getCapabilities() → Set<Capability>   (may or may not include "attachments")
```

No new entity owns or persists an `Attachment` beyond the `Message`/`SendInput` object it's
attached to — consistent with FR-009 (no default persistence of attachment content).
