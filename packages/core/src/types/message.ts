import type { Attachment } from "./attachment.js";
import type { Conversation } from "./conversation.js";
import type { Mention } from "./mention.js";
import type { Participant } from "./participant.js";

export interface Message {
  readonly id: string;
  readonly provider: string;
  readonly account: string;
  readonly sender: Participant;
  readonly conversation: Conversation;
  readonly text?: string;
  readonly attachments?: readonly Attachment[];
  readonly createdAt: Date;
  readonly replyToMessageId?: string;
  /**
   * People referenced in `text`, ordered by where they appear in it (ascending `offset`).
   *
   * Omitted entirely — never an empty array — when the message references no one, so a
   * message without mentions keeps exactly the shape it had before mentions existed.
   * Only adapters declaring the `"mentions"` capability populate this.
   */
  readonly mentions?: readonly Mention[];
}
