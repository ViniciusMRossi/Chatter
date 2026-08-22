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
  /**
   * When this message was last edited, if it ever was.
   *
   * Omitted entirely — never present-but-`undefined`, never a sentinel — when the message
   * has never been edited, so an unedited message keeps exactly the shape it had before
   * edits existed. Consumers can rely on `"editedAt" in message` as the test.
   *
   * `createdAt` always remains the ORIGINAL send time and is never overwritten by an edit,
   * so the two together answer "when was this said" and "when was it last changed"
   * separately. Only adapters declaring the `"editNotifications"` capability ever populate
   * this.
   */
  readonly editedAt?: Date;
}
