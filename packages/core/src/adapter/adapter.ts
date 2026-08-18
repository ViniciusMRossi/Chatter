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

export interface AccountAdapter {
  readonly provider: string;
  getCapabilities(): ReadonlySet<Capability>;
  start(dispatch: (message: InboundMessage) => void): Promise<void>;
  stop(): Promise<void>;
  send(input: SendInput): Promise<AdapterDeliveryResult>;
}
