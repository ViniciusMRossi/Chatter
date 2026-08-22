import type { Attachment } from "../types/attachment.js";
import type { Capability } from "../types/capability.js";
import type { Conversation } from "../types/conversation.js";
import type { DeliveryResult } from "../types/delivery-result.js";
import type { Message } from "../types/message.js";

export interface SendInput {
  readonly conversation: Conversation;
  readonly text?: string;
  readonly attachment?: Attachment;
  readonly replyToMessageId?: string;
}

/**
 * The application-level account name is assigned by the orchestrator at registration
 * time, not known to the adapter itself — so adapters exchange account-less shapes here
 * and `Chatter` fills in `account` before anything reaches application code.
 */
export type InboundMessage = Omit<Message, "account">;
export type AdapterDeliveryResult = Omit<DeliveryResult, "account">;

/**
 * Something an adapter observed on the provider, tagged with what kind of thing it was.
 *
 * The tag exists because there is now more than one thing an adapter can observe. It
 * replaces a bare `InboundMessage` callback, which could express exactly one event and so
 * left a second kind nowhere to go.
 *
 * Two backward-compatible alternatives were considered and rejected. A second optional
 * callback (`start(dispatch, onEdit?)`) breaks nothing, and is the shape that makes the
 * problem permanent — reactions would add a third parameter, and each future inbound
 * feature another. Widening this to `InboundMessage | InboundEvent` also breaks nothing
 * and typechecks under method-parameter bivariance, but leaves two ways to say "a message
 * was created" forever, so every consumer would have to handle both shapes indefinitely.
 *
 * A new inbound kind is added here as a new member — nowhere else.
 */
export type InboundEvent =
  | { readonly kind: "message.created"; readonly message: InboundMessage }
  | { readonly kind: "message.edited"; readonly message: InboundMessage };

export interface EditInput {
  readonly conversation: Conversation;
  /** The message to change, identified by the `providerMessageId` `send()` returned. */
  readonly messageId: string;
  /**
   * Replacement content. Becomes the message's caption when the message carries one and
   * its text when it carries text — the adapter determines which from what the message
   * actually has, never from an assumption made here.
   *
   * Required, not optional: an edit with nothing to change has no meaning, and an optional
   * field would create a second silent no-op path beside the one Chatter deliberately
   * refuses to hide (an edit to identical content surfaces as a categorized failure).
   */
  readonly text: string;
}

export interface DeleteInput {
  readonly conversation: Conversation;
  readonly messageId: string;
}

export interface AccountAdapter {
  readonly provider: string;
  getCapabilities(): ReadonlySet<Capability>;
  start(dispatch: (event: InboundEvent) => void): Promise<void>;
  stop(): Promise<void>;
  send(input: SendInput): Promise<AdapterDeliveryResult>;
  /**
   * Change a message's content in place. Required if — and only if — the adapter declares
   * the `"editMessage"` capability; `Chatter` rejects with
   * `ChatterUnsupportedCapabilityError` before calling either way, so an adapter that does
   * not declare it need not supply a throwing stub.
   */
  editMessage?(input: EditInput): Promise<AdapterDeliveryResult>;
  /** Remove a message. Required if and only if `"deleteMessage"` is declared — see above. */
  deleteMessage?(input: DeleteInput): Promise<AdapterDeliveryResult>;
}
