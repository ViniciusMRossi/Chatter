# Manual Verification Checklist

This adapter's automated test suite runs entirely against a stubbed transport — by design, so
CI needs no real Telegram credentials (see `tests/support/stub-transport.ts`). That means
nothing in CI has ever proven the adapter works against Telegram's actual servers. This
checklist is that proof, run by a human with a real bot. It cannot be automated by an agent in
an environment with no live Telegram credentials.

Uses `example-apps/telegram-echo` from ticket #2 as the application under test — see that
example's own `README.md` for setup details this checklist doesn't repeat.

The [`bruno/telegram-adapter/`](../../bruno/telegram-adapter) collection has ready-made requests
for several steps below (`Get Webhook Info`, `Send Message`, and synthetic webhook deliveries
under `local-webhook/`) if you'd rather click a saved request than hand-craft `curl` calls.

## Prerequisites

- [x] A Telegram bot token from [@BotFather](https://t.me/BotFather) (see
      `packages/telegram/README.md` §1).
- [x] A public HTTPS URL reachable from Telegram's servers (a tunnel like `ngrok` works for
      local development — see `packages/telegram/README.md` §3).

## 1. Webhook registration

- [x] Start `example-apps/telegram-echo` with real `TELEGRAM_BOT_TOKEN`,
      `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_WEBHOOK_URL` environment variables set (see that
      example's README).
- [x] Confirm the process starts without throwing — `chatter.start()` calling `getMe()` then
      `setWebhook()` against Telegram's real servers should both succeed.
- [x] Optionally confirm via `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` (in a browser,
      `curl`, or the Bruno collection's `Get Webhook Info` request) that `url` matches your
      configured webhook URL and `last_error_message` is empty.

## 2. Direct chat round trip

- [x] Open a private chat with your bot on Telegram and send it a text message.
- [x] Confirm the bot replies with `echo: <your message>` within a few seconds.
- [x] Confirm the reply appears as an actual Telegram reply (quoting your original message), not
      just a new message in the chat.

## 3. Group chat round trip

- [x] Add the bot to a Telegram group. If it doesn't receive ordinary group messages, disable
      its privacy mode via BotFather (`/setprivacy` → Disable), or @-mention the bot instead
      (see `packages/telegram/README.md` "Required permissions").
- [x] Send a message in the group.
- [x] Confirm the bot replies in the group — using the exact same running process and code as
      step 2, no restart or reconfiguration in between.

## 4. Duplicate delivery (optional, harder to trigger deliberately)

- [ ] If your tunnel/server setup lets you simulate a slow response (e.g. add a temporary delay
      before responding 200), send a message and confirm Telegram's retry (if it occurs) does
      not produce a second reply. This is best-effort to trigger manually — the automated
      `duplicate-delivery.spec.ts` test already proves the mechanism works in isolation; this
      step is about confirming it also holds under real network conditions.

      _Not attempted in the 2026-08-18 run below — optional and genuinely hard to trigger
      deliberately; the automated test already covers the mechanism itself._

## 5. Shutdown

- [x] Stop the process (e.g. Ctrl+C after wiring a shutdown handler that calls
      `chatter.stop()`, or manually invoke `adapter.stop()` before exiting).
- [x] Confirm via `getWebhookInfo` (as in step 1) that `url` is now empty — the webhook was
      successfully removed.

      _Running this checklist for the first time (see log below) found that
      `example-apps/telegram-echo` had no `SIGINT`/`SIGTERM` handler at all — Ctrl+C just killed
      the process without ever calling `chatter.stop()`, leaving the webhook registered. Fixed
      alongside this run; see the example app's own git history for that change._

## Recording results

Note the date, Telegram bot username used (not the token), and pass/fail for each section in
`Docs/Dev-log.md` or the PR description when this checklist is run — so there's a record of
when the adapter was last actually verified against real Telegram infrastructure, not just
against the stub.

### Verification log

| Date | Bot username | Sections 1-3, 5 | Section 4 | Notes |
|------|---------------|:---:|:---:|-------|
| 2026-08-18 | `@[redacted]_bot` (Chatter Test Bot) | ✅ Pass | Not attempted (optional) | First real-Telegram run since ticket #2. Direct chat, group chat, and shutdown all verified against real Telegram infrastructure. Found and fixed a real gap: the example app had no graceful-shutdown wiring — see the shutdown handler fix in the same PR. |
