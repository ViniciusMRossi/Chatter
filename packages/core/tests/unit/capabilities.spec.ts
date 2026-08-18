import { describe, expect, it } from "vitest";
import { Chatter, ChatterUnsupportedCapabilityError } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("capability discovery", () => {
  it("Chatter.getCapabilities() reflects the account's declared capability set", () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text", "reply"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });

    const capabilities = chatter.getCapabilities("bot");

    expect(capabilities.has("text")).toBe(true);
    expect(capabilities.has("reply")).toBe(true);
    expect(capabilities.has("thread")).toBe(false);
  });

  it("rejects a thread-targeted send on an account without the thread capability", async () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text", "reply"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });
    await chatter.start();

    await expect(
      chatter.send({
        account: "bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "channel-1",
          providerThreadId: "thread-1",
          type: "channel",
        },
        text: "hello",
      }),
    ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);

    await chatter.stop();
  });
});
