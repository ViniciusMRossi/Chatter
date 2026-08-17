import type { Capability } from "../types/capability.js";
import type { Conversation } from "../types/conversation.js";
import type { DeliveryResult } from "../types/delivery-result.js";
import type { MessageCreatedEvent } from "../types/event.js";

export interface SendInput {
  readonly conversation: Conversation;
  readonly text: string;
  readonly replyToMessageId?: string;
}

export interface AccountAdapter {
  readonly provider: string;
  getCapabilities(): ReadonlySet<Capability>;
  start(dispatch: (event: MessageCreatedEvent) => void): Promise<void>;
  stop(): Promise<void>;
  send(input: SendInput): Promise<DeliveryResult>;
}
