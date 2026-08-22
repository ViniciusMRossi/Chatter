# Contract: Outbound Edit and Delete

**Feature**: 007-message-edits-deletions | **Surface**: `@chatter/core` adapter boundary +
`Chatter` orchestrator

Binding on every adapter declaring `"editMessage"` or `"deleteMessage"`.

---

## C7 — Signatures

```ts
// On AccountAdapter — optional; an adapter not declaring the capability omits the method.
editMessage?(input: EditInput): Promise<AdapterDeliveryResult>;
deleteMessage?(input: DeleteInput): Promise<AdapterDeliveryResult>;

// On Chatter — account-scoped, as send() already is.
chatter.editMessage({ account, conversation, messageId, text }): Promise<DeliveryResult>;
chatter.deleteMessage({ account, conversation, messageId }): Promise<DeliveryResult>;
```

Both carry `conversation` alongside `messageId` because providers address a message by
(chat, message id), not by id alone — the same pair `send()` already round-trips through
`DeliveryResult`.

`EditInput.text` is required. An edit with nothing to change has no meaning, and an optional field
would create a second silent no-op path beside the one C10 explicitly refuses to hide.

---

## C8 — Capability gate

**MUST** reject with `ChatterUnsupportedCapabilityError` **before any provider request is made**
(FR-018) when either:

1. the account does not declare the matching capability, or
2. it declares the capability but the adapter does not implement the method.

Case 2 is an adapter bug. The runtime guard exists so it surfaces as a typed Chatter error rather
than `TypeError: adapter.editMessage is not a function`; conformance (FR-024) is what catches it
before release. The gate lives in the orchestrator so it applies uniformly to every adapter rather
than depending on each one to remember (research D10).

---

## C9 — Text versus caption (FR-017)

An edit MUST change the message's **caption** when the message carries one and its **text** when it
carries text. The choice MUST be made from what the message actually carries — **not assumed**, and
not taken from the caller.

Chatter holds no record of the messages it has sent (FR-005, Principle VI) and Telegram gives bots
no way to fetch a message by id, so the provider's own answer is the only available source of
truth. The Telegram adapter therefore:

1. attempts the text edit;
2. on the specific `there is no text in the message to edit` rejection, retries as a caption edit;
3. surfaces the **fallback's** error if that also fails — the second call is the one that made the
   real attempt against the field the message actually has.

Cost, accepted knowingly: editing a caption is two round trips; editing text — the common case —
is one. Alternatives (a caller-supplied discriminant, or remembering what was sent) were rejected
in research D6, the first for assuming what FR-017 forbids assuming, the second for requiring the
persistence Principle VI forbids.

---

## C10 — Editing to identical content (FR-020)

A provider rejecting an edit because the new content matches the current content MUST surface as a
**categorized failure**. It MUST NOT be reported as success and MUST NOT be swallowed.

**Mapped to `ChatterConfigurationError`** — the category this codebase already uses for
caller-supplied input the provider will reject (over-length text, oversized attachments), not
merely for startup misconfiguration.

**MUST NOT** be reported as `ChatterInvalidTargetError` (the target is valid and reachable) or as
`ChatterAuthorizationError` (nothing was refused on permission grounds). Both would send a
developer hunting a defect that is not there.

Rationale, so this is not re-litigated: reporting success would present a request the provider
refused as having been carried out, and would conceal a real class of defect — an application whose
edit silently "succeeds" every time because it keeps recomputing the same content. **Accepted
cost, stated plainly: an application that edits a status message on a timer will meet this
rejection routinely and must handle it.**

---

## C11 — Failure categories

Every failure MUST be programmatically distinguishable without parsing a human-readable string
(SC-004). No new error class is introduced.

| Condition | Mapped to |
|---|---|
| Capability undeclared, or method absent | `ChatterUnsupportedCapabilityError` |
| Message or chat not reachable | `ChatterInvalidTargetError` |
| Not permitted to act on this message | `ChatterAuthorizationError` |
| Provider refused: time limit passed | `ChatterAuthorizationError` *(see note)* |
| Edit would change nothing | `ChatterConfigurationError` (C10) |
| Rate limited | `ChatterRateLimitError`, with `retryAfterMs` when supplied |
| Transport failure | `ChatterProviderUnavailableError`, retryable |
| Anything else | `ChatterUnknownError` |

**Note on the time-limit row**: FR-019 asks for the elapsed-time refusal to be distinguishable, and
Telegram does not make it distinguishable — it expresses the refusal as a permission failure rather
than a distinct code. It therefore shares `ChatterAuthorizationError`, with the provider's own
description preserved in the message and the underlying error attached as `cause`. Recorded as a
known coarseness rather than papered over: the category is truthful (the account may not do this
*now*), and manufacturing a finer distinction from description-string matching alone would assert
something the provider is not actually saying.

---

## C12 — No local pre-judgement of provider limits (FR-021)

An adapter MUST NOT decide locally that a provider's time window has elapsed and refuse the request
itself. It MUST attempt the operation and report the provider's answer.

A limit evaluated against a local clock is wrong near the boundary whenever clocks disagree, and
would refuse operations the provider would have accepted.

**Contrast with existing behavior, deliberately**: `send()` *does* pre-validate message length and
attachment size (003, 004). That is consistent, not contradictory — length and size are fully
knowable locally and cannot change between the check and the call. Elapsed time is neither.

---

## C13 — Success outcome

Both operations resolve to `DeliveryResult`, the shape `send()` already returns (FR-022).

| Field | On edit | On delete |
|---|---|---|
| `providerMessageId` | id of the message edited | id of the message removed |
| `conversation` | as supplied | as supplied |
| `timestamp` | edit time when the provider reports one | **omitted** — Telegram returns only `true`, and a locally synthesized time would present a guess as a provider fact |

---

## C14 — Whose messages may be acted on

Chatter does **not** restrict either operation to messages the account itself sent. It forwards the
request and reports the provider's answer.

Deciding who may change or remove which message is the provider's authorization model.
Reimplementing it locally would duplicate it and then drift from it, and would mean refusing
operations the provider would have allowed — an account with the right permissions can remove
another participant's message through Chatter, exactly as it could directly.

---

## Conformance checks derived from this contract

| Check | Requirement |
|---|---|
| Operation against an undeclared capability rejects with `ChatterUnsupportedCapabilityError`, with no provider request made | FR-018, C8 |
| Operation against a target the provider rejects surfaces a categorized error, not a generic failure or silent success | FR-026, C11 |
| An edit rejected for identical content does **not** pass as success | FR-020, FR-026, C10 |
| A successful operation returns a result identifying the message acted on | FR-022, C13 |
| An adapter declaring either capability implements the corresponding method | FR-024, C8 |
