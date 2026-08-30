# Chatter — Cross-Provider Core Mapping

## Purpose

This table is the required Core freeze pressure-test artifact.

It does **not** mean Slack, Telegram, or Discord are being implemented in parallel.

It tests whether Core concepts can represent the four target providers before public types are frozen.

The table combines the accepted external architecture review with current official provider documentation where available.

---

# 1. Core Mapping

| Core concept | WhatsApp | Slack | Telegram | Discord | Core consequence |
|---|---|---|---|---|---|
| Message operation identity | Provider message id exists, but reply/reaction operations also require recipient/conversation context | Message `ts` is used together with a channel id for reactions and message operations | Bot API reaction/edit operations require both `chat_id` and `message_id`; `message_id` is unique inside the chat | Message objects expose both message id and channel id; message operations are channel-scoped | `MessageRef` includes `conversationId` universally |
| Conversation | Direct business/customer conversation is the main Cloud API V1 shape | DM, group DM, channel | Private chat, group, supergroup, channel; forum topic adds thread/topic id | DM/group DM/guild channels; threads are channel types; channel type may rely on gateway/cache context rather than being directly present in a message payload | Universal `Conversation`, not `Channel`; `ConversationType` is open; allow optional `parent` for child conversations |
| Sender snapshot | Webhook payload can include customer profile/contact information alongside inbound messages | Event payload carries user/bot ids; richer profile may require another API call | `Message.from` and `Message.chat` carry sender/chat snapshots | Message carries author and channel context | Normalize free payload data; no implicit enrichment I/O |
| Self identity | Outbound business identity is provider-account based; inbound user messages are normally not self echoes | Bot/app messages may appear in events, so self identity matters | Bot identity is known from bot account context | Bot/user identity is known and message author is explicit | Expose account self identity and normalized `isOwn` |
| Reply semantics | Reply/context is message-linked; no general thread system | Reply may begin/continue a message-anchored thread | Reply is distinct from forum topic/thread id | Reply is distinct from thread channel | Keep reply and thread separate |
| Thread model | None as a general WhatsApp Cloud API V1 conversation model | Message-anchored using thread timestamp | Forum topics are conversation-like child contexts | Threads are channel-like child conversations | Typed thread descriptor/context model; add optional `Conversation.parent` for conversation-shaped child contexts; do not force one shape |
| Edit/delete | Not part of current WhatsApp V1 common plan | Supported with permissions/ownership constraints | Bot API supports editing/deleting under constraints | Supported subject to permissions | `message.edit/delete` are optional contextual capabilities |
| Reactions | WhatsApp supports message reactions with provider-specific constraints | Reaction events contain channel + message ts; Slack supports named/custom emoji semantics | Bot API `setMessageReaction` requires `chat_id` + `message_id`; bot constraints apply | Multiple/custom emoji behavior and permissions exist | Typed reaction descriptor; reaction events; MessageRef needs conversation |
| Message statuses | Rich provider-specific sent/delivered/read/failed webhook statuses | No equivalent universal delivery/read progression | No universal bot delivery receipts | No equivalent WhatsApp-style universal progression | Status remains provider-specific |
| History/discovery | Do not assume a universal Cloud API conversation-history source | Slack has conversation history/replies APIs | Telegram Bot API is update-driven; provider-specific history semantics must not be generalized from MTProto | Discord APIs/SDKs have channel/message retrieval semantics, with product-specific limits | No universal history requirement; provider-backed history is capability-gated |
| Media retrieval | Authenticated/temporary provider media retrieval | Slack file retrieval may require auth | Bot API `getFile` / provider file transport has limits | CDN/media URLs have Discord-specific semantics | Shared `attachment.download`; server-side provider auth; no browser credentials |
| Lifecycle | Webhook-based, no persistent connection required for readiness | HTTP receiver or Socket Mode depending integration | Long polling or webhook; only one update mode at a time | Gateway connection genuinely exercises reconnect | Use `ready`, preserve `reconnecting`, avoid connection-centric universal assumptions |
| Provider container | WABA/app/phone-number structures exist but are not a universal conversation parent | Workspace/team exists above channels | Chat itself is primary container; forum topic can be child | Guild exists above channels | Do not freeze a universal container now; allow additive future `container` |
| Capability gating | Provider policy may reject valid operations at send time | Permissions/install scopes/context constrain operations | Chat permissions/bot limits constrain operations | Channel permissions and intents constrain operations | Capability = semantic support; provider authorization/policy = normalized errors |
| Provider-specific structured content | Templates, interactive messages, Flows | Block Kit/views/etc. | Keyboards/provider content | Components/embeds/interactions | `MessageContent.extensions` + provider-specific typed APIs |

---

# 2. Provider Pressure-Test Notes

## WhatsApp

Core must not infer that all providers have:

- history;
- threads;
- edit/delete;
- persistent connections.

WhatsApp-specific status richness remains outside the common event status model.

The customer-service window is provider policy, not a Chatter-maintained capability state.

## Slack

Slack is the first strong pressure test for:

- self-message identity;
- edit/delete;
- message-anchored threads;
- multi/custom reactions;
- workspace container;
- lifecycle integration differences between HTTP receiver and Socket Mode.

## Telegram

Telegram strongly validates `MessageRef.conversationId`.

Current Bot API documentation describes reaction operations using both `chat_id` and `message_id`, and identifies message ids within the chat.

Polling vs webhook is a real lifecycle mode and must not leak into a false "all providers are sockets" model.

Forum topics are conversation-like thread contexts.

## Discord

Discord notes:

- `Conversation.type` may rely on gateway/cache context rather than a direct field in every message event. Rule N still forbids an extra HTTP lookup; an unknown/future conversation type must degrade through the open `ConversationType` fallback.
- real reconnect lifecycle;
- permission/intents-driven operation availability;
- threads as channel-like entities;
- custom reactions;
- guild/container pressure.

---

# 3. Core Freeze Conclusions

The mapping supports these decisions:

1. `MessageRef` must include `conversationId`.
2. `Conversation` is the common navigation/message context.
3. Reply and thread stay distinct.
4. Thread shape must remain provider-sensitive.
5. Capabilities are contextual and typed.
6. Capability resolution must not promise authorization.
7. Common lifecycle state should use `ready`, not `connected`.
8. `reconnecting` is worth reserving before Discord implementation.
9. Provider-specific delivery/read status remains provider-specific.
10. Media retrieval is a shared transport problem.
11. A universal persistent history API is not required.
12. A future container concept should be additively possible but not frozen now.

---

# 4. Official Reference Links Used for the Pressure Test

## Slack

- Slack API documentation: https://api.slack.com/
- Events API documentation: https://api.slack.com/apis/events-api
- Conversations API documentation: https://api.slack.com/apis/conversations-api

## Telegram

- Bot API (messages, edits/deletes, reactions, files): https://core.telegram.org/bots/api
- Bot FAQ / update delivery behavior: https://core.telegram.org/bots/faq

## Discord

- Developer documentation root: https://discord.com/developers/docs
- Message resource: https://discord.com/developers/docs/resources/message
- Channel/thread concepts: https://discord.com/developers/docs/resources/channel
- Thread permissions overview: https://support.discord.com/hc/en-us/articles/10543994968087-Channel-Permissions-Settings-101

## WhatsApp

The current architecture review and existing Chatter WhatsApp planning remain the source for the Cloud API-specific observations in this mapping. During the relevant WhatsApp Adapter SPI / webhook SpecMan features, add the exact Meta Cloud API reference links for every behavior used in executable contracts to the feature's research/spec artifacts and update this mapping when the architectural conclusion changes.

---

# 4A. Privacy Note on Refs

Provider-native ref components may contain personal data. In particular, WhatsApp direct-conversation identifiers may be phone numbers.

Canonical ref serialization is for stable identity/storage keys, not default logging. Observability must redact/hash provider-native `id` and `conversationId` values.

# 5. Maintenance Rule

Update this mapping whenever:

- a provider feature `spec.md` or implementation evidence reveals a mismatch;
- an upstream provider API changes a relevant semantic;
- a new common capability is proposed;
- a new entity/context type is added to Core.

A Core abstraction should not be generalized from one provider without updating this artifact.
