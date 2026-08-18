# Manual Verification Checklist

This adapter's automated test suite runs entirely against a stubbed transport — by design, so
CI needs no real Telegram credentials (see `tests/support/stub-transport.ts`). That means
nothing in CI has ever proven the adapter works against Telegram's actual servers. This
checklist is that proof, run by a human with a real bot. It cannot be automated by an agent in
an environment with no live Telegram credentials.

Uses `example-apps/telegram-echo` from ticket #2 as the application under test — see that
example's own `README.md` for setup details this checklist doesn't repeat.

## Prerequisites

- [ ] A Telegram bot token from [@BotFather](https://t.me/BotFather) (see
      `packages/telegram/README.md` §1).
- [ ] A public HTTPS URL reachable from Telegram's servers (a tunnel like `ngrok` works for
      local development — see `packages/telegram/README.md` §3).

## 1. Webhook registration

- [ ] Start `example-apps/telegram-echo` with real `TELEGRAM_BOT_TOKEN`,
      `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_WEBHOOK_URL` environment variables set (see that
      example's README).
- [ ] Confirm the process starts without throwing — `chatter.start()` calling `getMe()` then
      `setWebhook()` against Telegram's real servers should both succeed.
- [ ] Optionally confirm via `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` (in a browser
      or `curl`) that `url` matches your configured webhook URL and `last_error_message` is
      empty.

## 2. Direct chat round trip

- [ ] Open a private chat with your bot on Telegram and send it a text message.
- [ ] Confirm the bot replies with `echo: <your message>` within a few seconds.
- [ ] Confirm the reply appears as an actual Telegram reply (quoting your original message), not
      just a new message in the chat.

## 3. Group chat round trip

- [ ] Add the bot to a Telegram group. If it doesn't receive ordinary group messages, disable
      its privacy mode via BotFather (`/setprivacy` → Disable), or @-mention the bot instead
      (see `packages/telegram/README.md` "Required permissions").
- [ ] Send a message in the group.
- [ ] Confirm the bot replies in the group — using the exact same running process and code as
      step 2, no restart or reconfiguration in between.

## 4. Duplicate delivery (optional, harder to trigger deliberately)

- [ ] If your tunnel/server setup lets you simulate a slow response (e.g. add a temporary delay
      before responding 200), send a message and confirm Telegram's retry (if it occurs) does
      not produce a second reply. This is best-effort to trigger manually — the automated
      `duplicate-delivery.spec.ts` test already proves the mechanism works in isolation; this
      step is about confirming it also holds under real network conditions.

## 5. Shutdown

- [ ] Stop the process (e.g. Ctrl+C after wiring a shutdown handler that calls
      `chatter.stop()`, or manually invoke `adapter.stop()` before exiting).
- [ ] Confirm via `getWebhookInfo` (as in step 1) that `url` is now empty — the webhook was
      successfully removed.

## Recording results

Note the date, Telegram bot username used (not the token), and pass/fail for each section in
`Docs/Dev-log.md` or the PR description when this checklist is run — so there's a record of
when the adapter was last actually verified against real Telegram infrastructure, not just
against the stub.
