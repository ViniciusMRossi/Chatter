export interface Participant {
  readonly provider: string;
  readonly providerAccountId: string;
  readonly providerParticipantId: string;
  readonly displayName?: string;
}
