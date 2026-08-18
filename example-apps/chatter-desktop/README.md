# chatter-desktop

A minimal, Slack-inspired Electron desktop client for manually testing Chatter end-to-end —
text, images, videos, and files, both directions — against a real Telegram bot. Built on top of
`@chatter/telegram`'s attachment support (`specs/004-attachment-model`,
`specs/005-telegram-attachment-mapping`) once both were merged; not its own SDD ticket, same as
`example-apps/telegram-echo`.

## What it does

- Runs a webhook server (same pattern as `telegram-echo`) and shows every inbound message in a
  single-conversation view — the first person to message the bot becomes "the" conversation for
  the rest of the session (no multi-channel sidebar; this is a test client, not a Slack clone).
- **Images** render inline.
- **Videos and other files** render as a file chip (icon, filename, size) with an **Open**
  button that hands off to your OS's default application via `shell.openPath()` — no in-app
  video player or document viewer.
- Sending: type text and hit Enter/Send, or click 📎 to pick a local file (the current text
  field, if any, becomes that message's caption).

## Prerequisites

Same as `telegram-echo` — see `packages/telegram/README.md` §1 (bot token) and §3 (a public
HTTPS URL, e.g. via `ngrok`, for local development).

## Run it

```bash
pnpm install

TELEGRAM_BOT_TOKEN=<your bot token> \
TELEGRAM_WEBHOOK_SECRET=<any random string you choose> \
TELEGRAM_WEBHOOK_URL=<your public https url>/telegram-webhook \
PORT=3000 \
pnpm start
```

This builds the TypeScript sources and launches the Electron app. The status line at the top of
the window shows the webhook path once it's listening.

## A security note on attachment download URLs

Telegram's mechanism for letting you re-download a received file (`getFile`) produces a URL that
embeds your bot's own token — there's no alternative Telegram-side mechanism that doesn't (see
`packages/telegram/README.md`'s "Attachments" section). This app's main process is the **only**
place that URL is ever used: it's fetched there and converted to bytes (a `data:` URL for image
previews, or a temp file for "Open"). The renderer — the untrusted, web-content-like half of an
Electron app — never receives that URL, only the resulting bytes/data. Keep this design if you
extend this example: never pass a resolved Telegram download URL across the `contextBridge`.

## What this doesn't do (by design)

- No custom video player or document viewer — "Open" always hands off to the OS.
- No multi-conversation UI, no message history persistence across restarts, no editing/deleting.
- No provider other than Telegram — this app exists to exercise Chatter's normalized attachment
  contract, not to be a real chat client.
