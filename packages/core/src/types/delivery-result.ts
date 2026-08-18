import type { Conversation } from "./conversation.js";

export interface DeliveryResult {
  readonly provider: string;
  readonly account: string;
  readonly providerMessageId: string;
  readonly conversation: Conversation;
  readonly timestamp?: Date;
  readonly raw?: unknown;
}
