/**
 * A feature an adapter genuinely supports. Applications branch on these rather than on
 * provider names, so an adapter must only declare what it actually implements.
 *
 * `"mentions"` asserts *inbound* mention reporting only — that the adapter populates
 * `Message.mentions` from provider-supplied metadata. It makes no claim about composing
 * mentions on outgoing messages.
 */
export type Capability = "text" | "reply" | "thread" | "attachments" | "mentions";
