# telegram-echo

A minimal example application demonstrating `@chatter/telegram`: replies "echo: &lt;message&gt;"
to any text message, in both direct chats and group chats, using the same handler code for both
(see `src/index.ts`) — the same shape of application code shown in `@chatter/core`'s
illustrative example, now backed by a real provider instead of the fake adapter.

## Prerequisites

- A Telegram bot token (see `packages/telegram/README.md` §1 for how to create one via
  BotFather).
- A public HTTPS URL that reaches your machine (see `packages/telegram/README.md` §3 — a tunnel
  like `ngrok` works for local development).

## Run it

```bash
pnpm install

TELEGRAM_BOT_TOKEN=<your bot token> \
TELEGRAM_WEBHOOK_SECRET=<any random string you choose> \
TELEGRAM_WEBHOOK_URL=<your public https url>/telegram-webhook \
PORT=3000 \
pnpm start
```

On startup, the app registers the webhook with Telegram (via `chatter.start()`) and starts
listening on `PORT` (default `3000`) for POST requests at the path from
`TELEGRAM_WEBHOOK_URL`.

## Try it

- **Direct chat**: open a DM with your bot on Telegram and send it a text message. It should
  echo it back within a couple of seconds.
- **Group chat**: add the bot to a group and send a message there (you may need to disable the
  bot's group privacy mode via BotFather, or @-mention the bot — see
  `packages/telegram/README.md` "Required permissions"). The identical app code replies here
  too — no group-specific logic anywhere in `src/index.ts`.

## What this proves

This app is the manual-verification counterpart to `specs/002-telegram-adapter/spec.md`'s
Stories 1 and 2 — the Phase 2 roadmap exit criterion is "a Node.js example can communicate
bidirectionally with the provider in both a direct conversation and a group/channel without
provider-specific application logic," and this is that example.
