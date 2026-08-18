import { describe, expect, it } from "vitest";
import { UpdateDedupWindow } from "../../src/dedup/update-dedup-window.js";

describe("UpdateDedupWindow", () => {
  it("reports an unrecorded ID as not seen, and a recorded one as seen", () => {
    const window = new UpdateDedupWindow();

    expect(window.has(1)).toBe(false);
    window.record(1);
    expect(window.has(1)).toBe(true);
  });

  it("re-recording an already-seen ID is a no-op", () => {
    const window = new UpdateDedupWindow(2);

    window.record(1);
    window.record(1);
    window.record(2);

    // If record(1) had incorrectly consumed a capacity slot twice, id 1 would have been
    // evicted by the time id 2 is added to a capacity-2 window.
    expect(window.has(1)).toBe(true);
    expect(window.has(2)).toBe(true);
  });

  it("evicts the oldest entry once capacity is exceeded", () => {
    const window = new UpdateDedupWindow(2);

    window.record(1);
    window.record(2);
    window.record(3);

    expect(window.has(1)).toBe(false);
    expect(window.has(2)).toBe(true);
    expect(window.has(3)).toBe(true);
  });
});
