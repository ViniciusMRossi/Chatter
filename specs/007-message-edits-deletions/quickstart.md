# Quickstart: Validating Message Edits and Deletions

**Feature**: 007-message-edits-deletions

How to prove this feature works end to end. Every scenario below runs **without a real Telegram
account or credential**, per SC-005.

Details live in the companion artifacts rather than being repeated here:
[data-model.md](./data-model.md) for shapes, [contracts/](./contracts/) for the binding rules,
[research.md](./research.md) for why each decision was made.

---

## Prerequisites

```bash
pnpm install          # node_modules is not checked in
```

Windows note from the 006 handoff, still current: `pnpm -r build` fails in
`example-apps/chatter-desktop` (its build script uses `mkdir -p` and `cp`). Pre-existing and
unrelated — the three library packages build fine. Don't mistake it for something this feature
broke.

---

## The full gate

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

Baseline before this feature: core 20, testing 35, telegram 103, and Bruno 18 requests / 22 tests.
All must still pass, with additions — not replacements — from this work.

---

## Scenario 1 — An edit arrives as its own event (FR-001 – FR-004)

**Package**: `@chatter/telegram` integration tests

Feed the webhook handler a synthetic `message` update, then a synthetic `edited_message` update for
the same `message_id` with changed text.

**Expected**
- Two dispatches: one `"message.created"`, then one `"message.edited"`.
- The edit carries the new text.
- Both carry the same `message.id`.
- **A handler registered only for `"message.created"` sees exactly one message.** This is the
  FR-002 assertion that actually matters — assert the *absence*, not just the presence.

---

## Scenario 2 — Timestamps stay honest (FR-006, FR-007)

Same two updates as Scenario 1, inspecting timestamps.

**Expected**
- The created message has **no `editedAt` key at all** — assert with `"editedAt" in message`, not
  `=== undefined`. The distinction is the whole of FR-007.
- The edited message has `editedAt`, sourced from `edit_date`.
- `createdAt` is byte-identical between the two dispatches.

---

## Scenario 3 — Mentions follow the edited content (FR-008)

Send a message mentioning `@alice`, then edit it to mention `@bob` instead, then edit it to mention
nobody.

**Expected**
- Each edit reports the mentions of *that* content.
- The final edit reports **no `mentions` key**, not an empty array.
- `text.slice(offset, offset + length) === mention.text` holds on every edit.

Include an emoji before the mention in at least one edit. Offsets are UTF-16 code units; a mapper
"fixed" to use `[...text]` passes ASCII cases and shifts every mention after the emoji.

---

## Scenario 4 — A redelivered edit dispatches once (FR-009)

Post the same `edited_message` update twice with the same `update_id`.

**Expected**: one `"message.edited"` dispatch, two `200` responses.

Worth testing even though it already works: dedup runs before update-type branching, so this holds
by an ordering accident that a future refactor could silently undo (research D7).

---

## Scenario 5 — Editing a message (FR-015, FR-017, C9)

**Package**: `@chatter/telegram` unit tests, against a stubbed grammY `Api`.

| Case | Expected |
|---|---|
| Text message | one `editMessageText` call; resolves to a `DeliveryResult` naming the message |
| Caption message | `editMessageText` rejects with `there is no text in the message to edit`, then `editMessageCaption` is called and succeeds |
| Caption fallback also fails | the **fallback's** error surfaces, not the first one |

Assert the call sequence, not only the outcome — the two-round-trip cost for captions is the
accepted price of not assuming (D6), and a "fix" collapsing it to one call would break FR-017.

---

## Scenario 6 — Deleting a message (FR-016)

Stub `deleteMessage` to succeed, then to fail each way.

**Expected**: success resolves to a `DeliveryResult` whose `providerMessageId` is the removed id
and which carries **no `timestamp`** (C13 — Telegram returns only `true`).

---

## Scenario 7 — Every failure is categorized (FR-019, FR-020, SC-004)

Drive each row of the [C11 table](./contracts/outbound-ops.md#c11--failure-categories) through a
stubbed `Api` and assert the error **class**, never a message string.

The row that matters most: **`message is not modified` must reject, not resolve** — as
`ChatterConfigurationError`, and specifically *not* as `ChatterInvalidTargetError` or
`ChatterAuthorizationError` (C10). Assert what it must not be, too; that is where the
misattribution FR-020 forbids would actually show up.

---

## Scenario 8 — Capability gating (FR-018, C8)

Construct an adapter declaring neither outbound capability.

**Expected**: both operations reject with `ChatterUnsupportedCapabilityError`, and the stubbed
`Api` records **zero calls**. "Before any request is made" is half the requirement — assert it.

---

## Scenario 9 — The conformance suite holds the line (FR-023 – FR-027)

**Package**: `@chatter/testing`

1. Run the suite against the fake adapter with all new capabilities declared → passes.
2. **Temporarily remove `emitInbound` from the Telegram conformance config** and confirm a real
   failure naming the missing `"edit"` scenario — not a skip, not a pass. 006 verified its hook the
   same way; the check is worthless unless someone has watched it fail.
3. Confirm an adapter declaring `"editMessage"` without implementing the method fails the suite.

---

## Scenario 10 — Nothing changed for anyone else (SC-002)

The regression that would hurt most, and the easiest to miss.

**Expected**
- Every pre-existing test passes **unmodified**, with one permitted exception: the capability-set
  assertion in `packages/telegram/tests/unit/capabilities.spec.ts`, which asserts the set literally
  (`size === 4` → `7`). That is the feature, not a break — the same single-line change 006 made.
- An application registering only `"message.created"` behaves identically to before.
- A message that was never edited serializes byte-identically to before this feature.

If any *other* existing assertion needs touching, stop and work out why — it means something
changed shape that FR-007 and SC-002 say must not have.

---

## Scenario 11 — Executable API documentation (Bruno)

**Required in-PR by AGENTS.md**: the inbound webhook endpoint behaves materially differently for an
`edited_message` update.

```bash
pnpm --filter @chatter/telegram test:bruno    # or the documented equivalent
```

Add requests covering: an edit update dispatching an edit, an edit not appearing as a new message,
and `editedAt` present on the edit and absent on the original.

Use the `/last-message` introspection endpoint 006 added to the stub-backed test server — status
codes cannot verify this feature, since a correctly mapped edit and a broken one both return `200`.
Received-count sequencing will shift again; renumber the downstream security requests accordingly,
as 006 had to (the collection runs as an ordered suite, and a stale count fails every check after
it).

---

## What is deliberately *not* validated here

- **Being notified that someone deleted a message.** No test can exist, because no such event
  exists (FR-012). Telegram tells bots nothing when a message is deleted. If you are looking for
  this scenario, its absence is the feature working as specified — see
  [C6](./contracts/inbound-events.md#c6--deletions-are-not-reported).
- **Edits of channel posts.** Out of scope: inbound `channel_post` is itself unhandled, so an edit
  of one would be an edit of a message Chatter never delivered (research D5).
- **Recovering a message's previous content.** Not available at any layer, by design (FR-005).
