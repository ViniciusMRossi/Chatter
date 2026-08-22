# Quickstart: validating mentions

Runnable checks proving the feature works end to end. No Telegram account, bot token, or network
access is required by anything below (FR-020).

## Prerequisites

```bash
pnpm install          # node_modules is not checked in — required before anything else runs
pnpm -r build
```

## 1. Unit + integration tests

```bash
pnpm --filter @chatter/core test
pnpm --filter @chatter/testing test      # includes the conformance suite, both branches
pnpm --filter @chatter/telegram test
```

Expected: all green, including the new
`packages/telegram/tests/unit/mention-mapping.spec.ts` and
`packages/telegram/tests/integration/mention-round-trip.spec.ts`.

The checks that matter most, and what a failure in each would mean:

| Check | Proves | A failure means |
|---|---|---|
| Slice invariant across ASCII, accented, and emoji text | SC-003 | Offsets are being treated as code points, not UTF-16 code units — see research.md §1 |
| Captioned attachment with a mention in the caption | FR-010 | `entities` and `caption_entities` selection has drifted out of lockstep with the text/caption choice — research.md §5 |
| `@handle` mention carries no `participant` | FR-007, SC-004 | An identity is being fabricated from a username |
| `text_mention` carries a resolved `participant` | FR-006 | The `User` object on the entity is being ignored |
| `/start@mybot` produces zero mentions | FR-017 | Command entities are leaking into mention mapping |
| `@mybot` sets `isSelf`, `@someoneelse` does not | FR-008, FR-009 | Username comparison is missing, case-sensitive, or not stripping `@` |
| Out-of-range entity is skipped, message still dispatched | FR-015 | Malformed metadata is taking the whole message down |
| Message with no entities has no `mentions` field at all | FR-002 | An empty array is being emitted where absence is required |

## 2. Conformance suite, both branches

The conformance suite is the contract gate (FR-012). It must be exercised against an adapter that
declares `"mentions"` **and** one that does not:

```bash
pnpm --filter @chatter/testing test -- conformance
```

Expected: the mention checks run for the mentions-declaring fake adapter, and the
"no mentions field when undeclared" check runs for the restricted one. If an adapter declares
`"mentions"` without supplying `emitInboundWithMentions`, the suite must **fail loudly** — verify
this deliberately by temporarily removing the hook; a silent skip there is a regression in the
contract itself, not a passing test.

## 3. Bruno collection (CI-wired, stub-backed, no credentials)

```bash
pnpm --filter @chatter/telegram test:bruno
```

This starts the stub-backed webhook test server, replays the `local-webhook` collection against it,
and tears it down. Expected: all requests pass, including the three added by this feature —
`mention-message.yml`, `bot-command-not-a-mention.yml`, and
`check-received-count-after-mentions.yml`.

## 4. End-to-end in the desktop client (optional, requires a real bot)

Only this step needs real credentials, and it is a convenience check, not a gate:

```bash
pnpm --filter chatter-desktop dev
```

Send a message to the bot's group mentioning it (`@yourbot hello`) and a message mentioning someone
else. Expected: the inbound message carries a mention with `isSelf: true` in the first case and not
the second.

## Full gate before opening the PR

```bash
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm --filter @chatter/telegram test:bruno
```
