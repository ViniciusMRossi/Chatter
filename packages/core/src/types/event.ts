import type { Message } from "./message.js";

export interface MessageCreatedEvent {
  readonly type: "message.created";
  readonly account: string;
  readonly message: Message;
}

export type ChatterEvent = MessageCreatedEvent;
