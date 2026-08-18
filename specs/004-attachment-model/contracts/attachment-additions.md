# Contract: `@chatter/core` and `@chatter/testing` additions (attachment model)

This is a diff against ticket #1's `specs/001-core-foundation/contracts/core-api.md` — everything
not listed here is unchanged. As before, signatures are illustrative; naming refinements are
allowed as long as behavior matches.

## New type: `Attachment` (`@chatter/core`)

```ts
type AttachmentKind = "image" | "video" | "file";

type AttachmentSource = { readonly url: string } | { readonly data: Buffer };

interface Attachment {
  readonly kind: AttachmentKind;
  readonly source: AttachmentSource;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}
```

- Inbound attachments (reached via `Message.attachments`) MUST always use the `{ url: string }`
  source variant — an adapter MUST resolve any provider-specific reference to a ready-to-use
  download URL before constructing one (FR-003). This is a documented convention, not enforced by
  a separate type (see research.md).
- Outbound attachments (`SendInput.attachment`) MAY use either source variant.

## `Message` (extended, backward compatible)

```ts
interface Message {
  // ... everything from ticket #1, unchanged ...
  readonly attachments?: readonly Attachment[]; // NEW — FR-001
}
```

- Omitted and empty-array both mean "no attachments" — no adapter is required to emit `[]`
  explicitly for a text-only message; omission remains valid, matching every existing call site.

## `SendInput` (extended, backward compatible)

```ts
interface SendInput {
  // ... everything from ticket #1, unchanged ...
  readonly attachment?: Attachment; // NEW — FR-004, singular: at most one per call
}
```

- `text` and `attachment` are independent — either, neither being required to be present together
  is invalid only in the sense that at least one of `text`/`attachment` presumably carries the
  message's content; this ticket does not add a runtime check requiring at least one, since a
  message with neither was already representable (and not disallowed) before this ticket.

## `Capability` (extended, backward compatible)

```ts
type Capability = "text" | "reply" | "thread" | "attachments"; // NEW value — FR-005
```

## `AccountAdapter.send()` (behavior extended, signature unchanged)

- MUST reject with `ChatterUnsupportedCapabilityError` if `input.attachment` is present and
  `getCapabilities()` does not include `"attachments"` (FR-006).
- MAY reject with `ChatterConfigurationError` if `input.attachment.source` has a `data` (Buffer)
  variant whose `byteLength` exceeds an adapter-known limit — checked before any
  transmission-equivalent action (FR-007). Adapters with no known limit perform no such check.

## `@chatter/testing` fake adapter (extended)

```ts
class FakeAccountAdapter implements AccountAdapter {
  constructor(config?: {
    capabilities?: Capability[];
    maxAttachmentSizeBytes?: number; // NEW — enforced only against {data} sources
  });
  // ... emitInbound, sentMessages, simulateRateLimit unchanged ...
}
```

- `send()` now honors `input.attachment` per the two rules above, using `capabilities` and
  `maxAttachmentSizeBytes` from its own config.
- `sentMessages` entries continue to reflect exactly what was passed to `send()` — no
  attachment-specific echo/transform is introduced.

## `@chatter/testing` conformance suite (extended)

```ts
function runAccountConformanceSuite(config: {
  createAdapter: () => AccountAdapter;
  getKnownConversation: (adapter: AccountAdapter) => Conversation | Promise<Conversation>;
  getUnknownConversation: () => Conversation;
  getTestAttachment: () => Attachment; // NEW — required; must return a small, valid attachment
}): void;
```

- MUST additionally exercise (FR-008): a send with `getTestAttachment()` succeeds and returns a
  delivery result of the same shape as a text-only send, when `getCapabilities()` includes
  `"attachments"`; the same send rejects with `ChatterUnsupportedCapabilityError` when it does
  not.
- MUST NOT weaken, skip, or alter any existing (pre-attachment) check already in the suite — this
  is a strictly additive change to `ConformanceSuiteConfig` and its generated test cases.
- Existing callers of `runAccountConformanceSuite` (i.e. `@chatter/testing`'s own test file
  against `FakeAccountAdapter`) MUST supply `getTestAttachment` — this is a breaking change to the
  suite's *config* (a new required field), which is acceptable within this ticket's own package
  boundary since `@chatter/testing` is not yet consumed by an external adapter package (Telegram's
  own conformance test lands in the next ticket and will supply it from day one).
