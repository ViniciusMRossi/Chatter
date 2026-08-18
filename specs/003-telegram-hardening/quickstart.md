# Quickstart: Validating Telegram Adapter Hardening

## Automated validation (no credentials required)

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Expected: all existing `@chatter/telegram` tests from ticket #2 continue to pass (including
`conformance.spec.ts`, unmodified — SC-005), plus new tests covering:

- **Duplicate delivery (Story 1)**: POST the same synthetic `Update` (identical `update_id`)
  through the webhook handler twice; assert the application handler fires exactly once.
- **Migration surfacing (Story 2)**: queue a synthetic `GrammyError` with
  `parameters.migrate_to_chat_id` set on the stub transport's `sendMessage`; assert the
  resulting `ChatterInvalidTargetError`'s message contains the new chat ID.
- **Oversized message (Story 3)**: call `send()` with text over 4096 characters; assert it
  rejects with `ChatterConfigurationError` and that the stub transport recorded zero calls.
- **Cleanup failure (Story 4)**: queue a `deleteWebhook` failure on the stub transport; call
  `stop()` with an injected `onNonFatalError` spy; assert `stop()` resolves without throwing and
  the spy was called with a message that doesn't contain the configured bot token or webhook
  secret.

Zero real Telegram credentials are used anywhere in this step.

## Manual validation (Story 5 — requires a real bot)

See `packages/telegram/MANUAL-VERIFICATION.md` for the full checklist. In short: create a bot,
expose a tunnel, run `example-apps/telegram-echo` (from ticket #2), and confirm webhook
registration, a direct-chat reply, and a group-chat reply all work against Telegram's real
servers — the thing ticket #2 documented but never actually ran.
