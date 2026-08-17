import type { Conversation } from "./conversation.js";
import type { Participant } from "./participant.js";

export interface Message {
  readonly id: string;
  readonly provider: string;
  readonly account: string;
  readonly sender: Participant;
  readonly conversation: Conversation;
  readonly text: string;
  readonly createdAt: Date;
  readonly replyToMessageId?: string;
}
