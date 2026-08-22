/**
 * A feature an adapter genuinely supports. Applications branch on these rather than on
 * provider names, so an adapter must only declare what it actually implements.
 *
 * `"mentions"` asserts *inbound* mention reporting only — that the adapter populates
 * `Message.mentions` from provider-supplied metadata. It makes no claim about composing
 * mentions on outgoing messages.
 *
 * `"editNotifications"` asserts *inbound* edit reporting only — that the adapter dispatches
 * a `"message.edited"` event when a message it can observe is changed. It makes no claim
 * about being able to edit anything.
 *
 * `"editMessage"` and `"deleteMessage"` are the *outbound* counterparts: they assert that
 * the adapter implements the correspondingly named operation. They are declared
 * independently of each other and of `"editNotifications"`, because a provider may offer
 * any combination — reporting others' edits and being allowed to edit are unrelated
 * permissions.
 *
 * There is deliberately NO `"deleteNotifications"`. No supported provider tells a bot that
 * a message was deleted — Telegram's Bot API sends no such update at all — so a capability
 * asserting it could only ever be declared falsely, and application code would branch on
 * something permanently untrue. Its absence here is the feature, not an omission: see
 * `specs/007-message-edits-deletions/spec.md` FR-012.
 */
export type Capability =
  | "text"
  | "reply"
  | "thread"
  | "attachments"
  | "mentions"
  | "editNotifications"
  | "editMessage"
  | "deleteMessage";
