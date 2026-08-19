# Dev Log

One short entry per shipped feature, appended by `scripts/handoff.sh --feature-complete`.
Keep the "what" brief — focus on challenges and problems faced, in more detail than the happy
path.

## 2026-08-17 — 1 (unspecified)
Core package foundation: normalized types, adapter contract, Chatter orchestrator, typed errors, fake adapter, and adapter-agnostic conformance suite (issues #1-#34)

## 2026-08-18 — 36 (unspecified)
Telegram provider adapter: webhook-based inbound (direct+group chats), outbound send/reply via grammY, typed error mapping, capability enforcement, conformance-suite compliance, example app (issues #36-#72)

## 2026-08-18 — 74 (unspecified)
Telegram adapter hardening: update_id dedup, migrate_to_chat_id surfacing, message-length pre-validation, non-silent stop() cleanup, manual verification checklist (issues #74-#93)

## 2026-08-18 — chatter-desktop (unspecified)
Electron desktop test client (example-apps/chatter-desktop) merged: Slack-style sidebar with multi-conversation support and real group names, inline image/audio playback, file chips with OS-default-app handoff. Includes a @chatter/telegram library fix (voice/audio message dispatch, previously silently dropped). Next: continue depth-first Telegram feature completion (message edits/deletions, reactions, mentions, interactive components) before starting Slack, per standing roadmap directive — no specific ticket scoped yet.
