# API documentation (Bruno)

This directory documents, as runnable [Bruno](https://www.usebruno.com/) collections, every
HTTP endpoint Chatter's provider adapters actually touch — both outbound (calls an adapter makes
to a provider's API) and inbound (webhook endpoints a host application exposes). Collections are
plain text (YAML) and live in git alongside the code they document; opening one in Bruno doesn't
require any account, server, or sync service.

## Collections

- **`telegram-adapter/`** — `@chatter/telegram` (tickets #2/#3). Outbound Telegram Bot API calls
  (`getMe`, `setWebhook`, `deleteWebhook`, `sendMessage`, plus `getWebhookInfo` for manual
  inspection) and inbound synthetic webhook deliveries you can fire at your own locally running
  server. See that collection's `opencollection.yml` for details.

Future provider adapters (Slack, Discord, WhatsApp) should add their own sibling collection here
following the same `<provider>-adapter/` pattern.

## Setup

1. Install [Bruno](https://www.usebruno.com/) (desktop app) or the
   [Bruno CLI](https://docs.usebruno.com/bru-cli/overview) (`npm install -g @usebruno/cli`) if
   you'd rather run requests from a terminal / CI.
2. Open Bruno → **Open Collection** → select `bruno/telegram-adapter/` (or the relevant
   provider's folder).
3. Select the **Local** environment (top-right dropdown in the app).
4. Fill in the secret variables (`bot_token`, `webhook_secret`) **inside the Bruno app itself**,
   not by editing the committed `environments/local.yml` file — variables marked `secret: true`
   in that file are intentionally left blank; Bruno stores the values you enter locally, outside
   the synced collection, so they're never at risk of being committed.
5. Fill in the non-secret variables (`public_webhook_url`, `local_webhook_url`, `chat_id`) to
   match your setup — these have placeholder defaults you'll want to override.

## What's safe to commit here

Every file in this directory is safe to commit as-is: request definitions, folder structure, and
environment variable *names*/*descriptions*/non-secret defaults. No bot tokens, webhook secrets,
or other credentials are ever written to these files — see each environment file's `secret: true`
fields and `bruno/.gitignore`.
