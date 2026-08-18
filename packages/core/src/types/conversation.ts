export type ConversationType = "direct" | "group" | "channel" | "unknown";

export interface Conversation {
  readonly provider: string;
  readonly providerAccountId: string;
  readonly providerConversationId: string;
  readonly type: ConversationType;
  readonly providerThreadId?: string;
}
