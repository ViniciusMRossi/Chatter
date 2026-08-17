import { describe, expect, it } from "vitest";
import { Chatter, ChatterConfigurationError } from "../../src/index.js";
import { FakeAccountAdapter } from "@chatter/testing";

describe("Chatter lifecycle", () => {
  it("start() is idempotent", async () => {
    const chatter = new Chatter({
      accounts: [{ accountName: "bot", adapter: new FakeAccountAdapter() }],
    });

    await chatter.start();
    await expect(chatter.start()).resolves.toBeUndefined();

    await chatter.stop();
  });

  it("stop() is idempotent, including before start()", async () => {
    const chatter = new Chatter({
      accounts: [{ accountName: "bot", adapter: new FakeAccountAdapter() }],
    });

    await expect(chatter.stop()).resolves.toBeUndefined();

    await chatter.start();
    await chatter.stop();
    await expect(chatter.stop()).resolves.toBeUndefined();
  });

  it("send() rejects with ChatterConfigurationError before start()", async () => {
    const chatter = new Chatter({
      accounts: [{ accountName: "bot", adapter: new FakeAccountAdapter() }],
    });

    await expect(
      chatter.send({
        account: "bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "dm-1",
          type: "direct",
        },
        text: "hello",
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
  });

  it("send() rejects with ChatterConfigurationError after stop()", async () => {
    const chatter = new Chatter({
      accounts: [{ accountName: "bot", adapter: new FakeAccountAdapter() }],
    });

    await chatter.start();
    await chatter.stop();

    await expect(
      chatter.send({
        account: "bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "dm-1",
          type: "direct",
        },
        text: "hello",
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
  });
});
