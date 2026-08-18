# Quickstart: Validating the Telegram Provider Adapter

Two tiers, matching how this project treats E2E/UI validation elsewhere: automated (CI-safe, no
credentials) and manual (a real bot, run locally by a human).

## Automated validation (primary — no credentials required)

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Expected: `@chatter/telegram`'s unit tests (chat-type mapping, error mapping, secret validation),
integration tests (synthetic-`Update` round trip against a stubbed transport), and its
`conformance.spec.ts` (running `@chatter/testing`'s shared suite against this adapter) all pass —
this is SC-003, SC-004, and SC-005 from spec.md. Zero real Telegram credentials are used or
required anywhere in this step.

## Manual validation (Stories 1 & 2 — requires a real bot)

1. **Create a bot**: message [@BotFather](https://t.me/BotFather) on Telegram, `/newbot`, follow
   the prompts, save the token it gives you.
2. **Expose a local server publicly**: run a tunnel (e.g. `ngrok http 3000`) and note the public
   HTTPS URL it gives you — Telegram requires HTTPS for webhooks.
3. **Run the example app**:
   ```bash
   cd example-apps/telegram-echo
   TELEGRAM_BOT_TOKEN=<token> \
   TELEGRAM_WEBHOOK_SECRET=<any-random-string-you-choose> \
   TELEGRAM_WEBHOOK_URL=<your-tunnel-url>/telegram-webhook \
   pnpm start
   ```
   See `example-apps/telegram-echo/README.md` for the full walkthrough, including how the app
   registers the webhook on startup.
4. **Direct chat (Story 1)**: open a DM with your bot on Telegram, send it a text message.
   Expected: the bot echoes a reply in the same chat within a couple of seconds.
5. **Group chat (Story 2)**: add the bot to a Telegram group, send a message there (per
   Telegram's own group-visibility rules for bots — you may need to disable group privacy mode
   via BotFather, or @-mention the bot, depending on your bot's settings).
   Expected: the identical example app code replies in the group — no code change from step 4,
   only the fact that Telegram delivered a "group"-typed conversation this time.

## Security check (Story 3)

```bash
curl -X POST "<your-tunnel-url>/telegram-webhook" \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1}'
```
Expected: HTTP 401, and nothing appears in the example app's handler logs — no secret header was
sent. Repeat with `-H "X-Telegram-Bot-Api-Secret-Token: wrong-value"` for the same result with an
incorrect secret.

## Error-path checks (Story 4)

Covered by the automated suite (`pnpm -r test`), not manual steps — synthetic Telegram error
responses (401, "chat not found", 429 with `retry_after`) are fed through the stubbed transport
and asserted against the corresponding `ChatterError` subclass. See
`packages/telegram/tests/unit/errors.spec.ts` once implemented.
