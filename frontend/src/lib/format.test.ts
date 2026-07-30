import { describe, expect, it } from "vitest";
import { formatDuration, formatEpisode, initials } from "./format";

describe("display formatters", () => {
  it("formats episode coordinates", () => {
    expect(formatEpisode(2, 7)).toBe("S02 · E07");
  });

  it("formats Jellyfin ticks", () => {
    expect(formatDuration(String(90 * 60 * 10_000_000))).toBe("1 h 30");
  });

  it("creates short initials", () => {
    expect(initials("Jean Dupont")).toBe("JD");
  });
});
