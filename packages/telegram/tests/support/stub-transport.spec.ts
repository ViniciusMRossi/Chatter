import { describe, expect, it } from "vitest";
import { StubTelegramTransport } from "./stub-transport.js";

describe("StubTelegramTransport media defaults", () => {
  it("sendPhoto without a queued override returns a well-formed result", async () => {
    const stub = new StubTelegramTransport();
    const result = await stub.api.sendPhoto(555, "https://example.com/cat.png");
    expect(result.message_id).toBeTypeOf("number");
    expect(result.date).toBeTypeOf("number");
    expect(result.chat.id).toBe(555);
  });

  it("sendVideo without a queued override returns a well-formed result", async () => {
    const stub = new StubTelegramTransport();
    const result = await stub.api.sendVideo(555, "https://example.com/clip.mp4");
    expect(result.message_id).toBeTypeOf("number");
  });

  it("sendDocument without a queued override returns a well-formed result", async () => {
    const stub = new StubTelegramTransport();
    const result = await stub.api.sendDocument(555, "https://example.com/report.pdf");
    expect(result.message_id).toBeTypeOf("number");
  });

  it("getFile returns a file_path derived from the requested file_id", async () => {
    const stub = new StubTelegramTransport();
    const result = await stub.api.getFile("abc123");
    expect(result.file_id).toBe("abc123");
    expect(result.file_path).toContain("abc123");
  });
});
