# Phase 1 Data Model: Message Edits and Deletions

**Feature**: 007-message-edits-deletions | **Date**: 2026-08-22

Entities from [spec.md](./spec.md) resolved to concrete shapes. Decisions referenced as `D1`..`D10`
are recorded in [research.md](./research.md).

---

## 1. `Message` — one added field

```ts
export interface Message {
  readonly id: string;
  readonly provider: string;
  readonly account: string;
  readonly sender: Participant;
  readonly conversation: Conversation;
  readonly text?: string;
  readonly attachments?: readonly Attachment[];
  readonly createdAt: Date;
  readonly replyToMessageId?: string;
  readonly mentions?: readonly Mention[];

  /**
   * When this message was last edited, if it ever was.
   *
   * Omitted entirely — never `undefined`-valued, never a sentinel — when the message has
   * never been edited, so an unedited message keeps exactly the shape it had before edits
   * existed. `createdAt` always remains the ORIGINAL send time and is never overwritten by
   * an edit.
   */
  readonly editedAt?: Date;
}
```

**Validation rules**

| Rule | Source | Enforced by |
|---|---|---|
| `editedAt` absent ⟺ message never edited | FR-007 | mapper omits the key; conformance check asserts absence |
| `createdAt` unchanged across an edit of the same `id` | FR-006 | conformance check compares create vs edit dispatch |
| `editedAt >= createdAt` when both present | implied by FR-006 | mapper (values come from the provider; not synthesized) |
| `id` identical between original delivery and any edit of it | FR-003 | Telegram `message_id` is stable across edits |

**Not added, deliberately**: any field carrying prior content, prior text, or an edit count.
FR-005 — supplying prior content requires retaining message history, which Principle I forbids
(no conversational memory / message history) and Principle VI forbids again (no content
persistence by default).

---

## 2. `Capability` — three added members

```ts
export type Capability =
  | "text"
  | "reply"
  | "thread"
  | "attachments"
  | "mentions"
  | "editNotifications"
  | "editMessage"
  | "deleteMessage";
```

| Member | Direction | Asserts |
|---|---|---|
| `"editNotifications"` | inbound | The adapter dispatches `"message.edited"` when a message it can observe is changed. Makes no claim about editing. |
| `"editMessage"` | outbound | The adapter implements `editMessage()`. Makes no claim about reporting others' edits. |
| `"deleteMessage"` | outbound | The adapter implements `deleteMessage()`. |

**Deliberately absent: `"deleteNotifications"`.** FR-012. Telegram sends bots no notification of
any kind when a message is deleted, so no adapter could declare it truthfully, and application code
would branch on something permanently false. The gap sits directly beside `"editNotifications"` in
the union so it is visible at the type level rather than only in prose (D1).

Telegram declares all three. The fake adapter's defaults are unchanged; it gains the ability to
declare all three so the conformance suite can exercise them (FR-027).

---

## 3. `InboundEvent` — the adapter-boundary envelope (new)

The dispatch callback an adapter receives from `start()` changes from carrying a bare message to
carrying a tagged envelope (D3).

```ts
export type InboundEvent =
  | { readonly kind: "message.created"; readonly message: InboundMessage }
  | { readonly kind: "message.edited";  readonly message: InboundMessage };

export interface AccountAdapter {
  readonly provider: string;
  getCapabilities(): ReadonlySet<Capability>;
  start(dispatch: (event: InboundEvent) => void): Promise<void>;
  stop(): Promise<void>;
  send(input: SendInput): Promise<AdapterDeliveryResult>;
  editMessage?(input: EditInput): Promise<AdapterDeliveryResult>;
  deleteMessage?(input: DeleteInput): Promise<AdapterDeliveryResult>;
}
```

`InboundMessage` remains `Omit<Message, "account">` — the orchestrator still fills `account` in,
now on the message inside the envelope.

**State transition** — the whole lifecycle this feature models:

```
                 provider reports a new message
                 ──────────────────────────────▶  kind: "message.created"
                                                       │
                            provider reports a change  │  (same message.id)
                            ───────────────────────────▶  kind: "message.edited"   ⟳ repeatable
                                                       │
                            provider deletes it        │
                            ───────────────────────────▶  (nothing — not observable, FR-012)
```

Each edit dispatches independently and carries content as of that edit. Edits are never coalesced,
and there is no terminal state — the deletion arrow exists to show that the lifecycle Chatter can
observe simply *ends* without a final event.

---

## 4. `MessageEditedEvent` — the public event (new)

```ts
export interface MessageEditedEvent {
  readonly type: "message.edited";
  readonly account: string;
  readonly message: Message;   // content AS OF the edit; carries editedAt
}

export type ChatterEvent = MessageCreatedEvent | MessageEditedEvent;
```

`ChatterEvent` becomes a genuine union — it has had one member since core was written, and the
shape was always intended to grow this way.

**The FR-002 invariant, stated as a rule**: an edit MUST NOT be delivered to a `"message.created"`
handler. This is the requirement with real blast radius — every existing consumer appends or acts
on what arrives there, so a violation makes all of them double-handle with nothing to distinguish
the cases. Enforced by the orchestrator's event map and asserted directly by conformance (FR-025).

**Carries no previous state**, per FR-005. An application that needs "what it said before" keeps
its own copy; Chatter cannot supply it without becoming a message store.

---

## 5. `EditInput` / `DeleteInput` — outbound operation inputs (new)

```ts
export interface EditInput {
  readonly conversation: Conversation;
  /** The message to change, as identified by the `providerMessageId` send() returned. */
  readonly messageId: string;
  /** Replacement text. Becomes the message's caption when the message carries one (FR-017). */
  readonly text: string;
}

export interface DeleteInput {
  readonly conversation: Conversation;
  readonly messageId: string;
}
```

Both carry `conversation` because providers address a message by (chat, message id), not by id
alone — the same pair `send()` already round-trips through `DeliveryResult`.

`EditInput.text` is **required**, not optional: an edit with nothing to change has no meaning, and
making it optional would create a second silent no-op path alongside the one FR-020 already refuses
to hide.

**Not modelled**: replacing or adding an attachment. Out of scope per the spec.

---

## 6. Operation outcome

Both operations return `AdapterDeliveryResult` (`DeliveryResult` minus `account`, filled in by the
orchestrator) — the same shape `send()` returns, per FR-022 and D9.

| Field | On edit | On delete |
|---|---|---|
| `provider` | adapter's provider | adapter's provider |
| `providerMessageId` | id of the message edited | id of the message removed |
| `conversation` | as supplied | as supplied |
| `timestamp` | edit time when the provider reports one | **omitted** — Telegram returns only `true`; synthesizing a local clock value would present a guess as a provider fact |

---

## 7. Error mapping for outbound operations

FR-019 requires these to be distinguishable programmatically (SC-004). No new error class is
introduced — every case lands on the existing hierarchy.

| Condition | Telegram signal | Mapped to |
|---|---|---|
| Capability not declared, or method absent | *(never reaches the provider)* | `ChatterUnsupportedCapabilityError` |
| Message or chat not reachable | 400 `message to edit not found`, `message to delete not found`, `chat not found` | `ChatterInvalidTargetError` |
| Not permitted to act on the message | 400 `message can't be deleted`, 403 | `ChatterAuthorizationError` |
| Time limit passed | 400 `message can't be deleted for everyone` | `ChatterAuthorizationError` — see note |
| Edit would change nothing | 400 `message is not modified` | `ChatterConfigurationError` (D2) |
| Rate limited | 429 | `ChatterRateLimitError` with `retryAfterMs` |
| Transport failure | `HttpError` | `ChatterProviderUnavailableError`, retryable |
| Anything else | any other `GrammyError` | `ChatterUnknownError` |

**Note on the time-limit row**: FR-019 asks for the elapsed-time refusal to be distinguishable.
Telegram expresses it as a permission refusal rather than a distinct code, so it maps to
`ChatterAuthorizationError` with the provider's own description preserved in the message and the
`GrammyError` attached as `cause`. Recorded as a known coarseness rather than papered over: the
category is truthful (the account is not permitted to do this *now*), and inventing a finer
category from description-string matching alone would assert a distinction the provider is not
actually making. FR-021 still holds — the elapsed time is never pre-judged locally; this row only
describes what comes back after the attempt.

---

## 8. Conformance configuration (`@chatter/testing`)

```ts
export type InboundScenario = "mentions" | "edit";

export interface ConformanceSuiteConfig {
  // ...existing members unchanged...

  /**
   * Drives the adapter's real inbound path to produce the named scenario.
   * REQUIRED for any adapter declaring a capability that maps to a scenario — the suite
   * FAILS rather than skips when it is missing (FR-024).
   */
  readonly emitInbound?: (
    adapter: AccountAdapter,
    scenario: InboundScenario,
  ) => void | Promise<void>;
}
```

Replaces `emitInboundWithMentions` (D4). Capability→scenario table lives inside the suite:
`"mentions"` → `"mentions"`, `"editNotifications"` → `"edit"`. Adding reactions later adds one
union member and one table row — not a new config field, which is the entire point of FR-023.

---

## Requirements coverage

| Requirement | Where it lands |
|---|---|
| FR-001, FR-004 | §3 `InboundEvent`, §4 `MessageEditedEvent` |
| FR-002 | §4, enforced by the orchestrator event map |
| FR-003 | §1 validation rules |
| FR-005 | §1 "not added, deliberately"; §4 |
| FR-006, FR-007 | §1 `editedAt` |
| FR-008 | falls out of remapping the edited message (D8) |
| FR-009 | existing `UpdateDedupWindow`, unchanged (D7) |
| FR-010, FR-011 | webhook handler behavior; §3 |
| FR-012, FR-013, FR-014 | §2 deliberate absence |
| FR-015 – FR-017 | §5 `EditInput` / `DeleteInput`, D6 |
| FR-018 | §2 capabilities + §7 row 1, gated in the orchestrator (D10) |
| FR-019, FR-020 | §7 mapping table |
| FR-021 | §7 note — no local pre-judgement |
| FR-022 | §6 outcome shape |
| FR-023 – FR-027 | §8 conformance configuration |
