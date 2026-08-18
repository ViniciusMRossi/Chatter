import type { Capability } from "./capability.js";

export interface Account {
  readonly provider: string;
  readonly providerAccountId: string;
  readonly accountName: string;
  readonly capabilities: ReadonlySet<Capability>;
}
