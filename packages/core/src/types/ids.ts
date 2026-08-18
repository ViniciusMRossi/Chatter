export type AccountKey = `${string}:${string}`;
export type ParticipantKey = `${string}:${string}:${string}`;
export type ConversationKey = `${string}:${string}:${string}`;
export type ThreadKey = `${ConversationKey}:${string}`;

export function accountKey(provider: string, providerAccountId: string): AccountKey {
  return `${provider}:${providerAccountId}`;
}

export function participantKey(
  provider: string,
  providerAccountId: string,
  providerParticipantId: string,
): ParticipantKey {
  return `${provider}:${providerAccountId}:${providerParticipantId}`;
}

export function conversationKey(
  provider: string,
  providerAccountId: string,
  providerConversationId: string,
): ConversationKey {
  return `${provider}:${providerAccountId}:${providerConversationId}`;
}

export function threadKey(conversation: ConversationKey, providerThreadId: string): ThreadKey {
  return `${conversation}:${providerThreadId}`;
}
