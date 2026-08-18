import type { Participant } from "@chatter/core";
import type { User } from "@grammyjs/types";

export function mapParticipant(user: User, providerAccountId: string): Participant {
  const displayName =
    user.last_name !== undefined ? `${user.first_name} ${user.last_name}` : user.first_name;

  return {
    provider: "telegram",
    providerAccountId,
    providerParticipantId: String(user.id),
    displayName,
  };
}
