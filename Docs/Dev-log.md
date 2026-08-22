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

## 2026-08-22 — 006-mentions (claude-code)
Mentions: normalized Mention type in @chatter/core (UTF-16 offsets, optional participant, required isSelf) exposed as Message.mentions, plus a 'mentions' Capability; Telegram maps mention/text_mention entities for both text and captions, recognizing @handle and text_mention references to the bot itself. /command@botname deliberately produces no mention (FR-017). Conformance suite extended with an inbound-emission hook that FAILS rather than skips when an adapter declares 'mentions' without supplying it.

Problems worth remembering. The conformance suite turned out to be entirely send()-oriented, with no way to observe a dispatched inbound message — so an inbound-only feature could not be contract-tested at all without extending it first; the alternative was a Telegram unit test wearing a conformance label. Telegram supplies a separate entity array per text field (`entities` for text, `caption_entities` for caption) while mapMessage collapses both into one normalized `text`, so the two must be chosen by the same branch — reading the wrong array throws nothing and passes any test where both strings resemble each other. Offsets are UTF-16 code units, matching JS indexing exactly, so the "handle Unicode properly" instinct (`[...text]`, which indexes by code point) actively breaks emoji cases while looking right in ASCII. Bruno needed a new /last-message endpoint on the stub server: a correctly and an incorrectly mapped mention both return 200, so the FR-017 request would otherwise have asserted nothing.

Shipped on branch 006-mentions, 6 commits, not yet merged.
