import { describe, expect, it } from "vitest";
import { Chatter, ChatterConfigurationError } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("account registration", () => {
  it("throws ChatterConfigurationError synchronously for a duplicate account name", () => {
    expect(
      () =>
        new Chatter({
          accounts: [
            { accountName: "bot-a", adapter: new FakeAccountAdapter() },
            { accountName: "bot-a", adapter: new FakeAccountAdapter() },
          ],
        }),
    ).toThrow(ChatterConfigurationError);
  });

  it("allows two accounts registered under distinct names", () => {
    expect(
      () =>
        new Chatter({
          accounts: [
            { accountName: "bot-a", adapter: new FakeAccountAdapter() },
            { accountName: "bot-b", adapter: new FakeAccountAdapter() },
          ],
        }),
    ).not.toThrow();
  });
});
