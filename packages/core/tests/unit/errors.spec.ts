import { describe, expect, it } from "vitest";
import { Chatter, ChatterInvalidTargetError } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("typed errors", () => {
  it("rejects a send to an unrecognized conversation with ChatterInvalidTargetError", async () => {
    const adapter = new FakeAccountAdapter();
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });
    await chatter.start();

    await expect(
      chatter.send({
        account: "bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "never-seen",
          type: "direct",
        },
        text: "hello",
      }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);

    await chatter.stop();
  });
});
