import type { Message } from "./message.js";

export interface MessageCreatedEvent {
  readonly type: "message.created";
  readonly account: string;
  readonly message: Message;
}

/**
 * A message that already existed has been changed by the provider.
 *
 * Deliberately a separate event type rather than a re-issued `MessageCreatedEvent`.
 * Applications written before edits existed append or act on whatever arrives through
 * `"message.created"`; routing edits there would make every one of them silently
 * double-handle — appending a duplicate, re-running a side effect — with nothing in the
 * payload to tell the two cases apart. A distinct type is ignored by default by every
 * existing consumer, which is what makes edits additive rather than breaking.
 *
 * `message` carries the content AS OF the edit, and reuses the `id` the message was first
 * delivered under, so an application correlates the two by id.
 *
 * It carries NO previous content. Supplying that would require Chatter to remember every
 * message it has delivered, which the constitution forbids twice over (no message history,
 * no content persistence by default). What the message said before is the application's to
 * keep if it needs it.
 */
export interface MessageEditedEvent {
  readonly type: "message.edited";
  readonly account: string;
  readonly message: Message;
}

export type ChatterEvent = MessageCreatedEvent | MessageEditedEvent;
