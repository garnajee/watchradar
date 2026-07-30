import { describe, expect, it } from "vitest";
import { isHistoryItemVisible, isPlaybackVisible } from "./privacy.js";

describe("playback privacy", () => {
  const selected = new Set(["movie-selected", "series-selected"]);

  it("shares all active playback in ALL mode", () => {
    expect(isPlaybackVisible("ALL", "movie-other", null, selected)).toBe(true);
  });

  it("shares only the current item in ONLY_WATCHING mode", () => {
    expect(isPlaybackVisible("ONLY_WATCHING", "episode", "series-other", selected)).toBe(true);
    expect(isPlaybackVisible("ONLY_WATCHING", null, null, selected)).toBe(false);
  });

  it("accepts selected items and episodes from selected series", () => {
    expect(isPlaybackVisible("SELECTED", "movie-selected", null, selected)).toBe(true);
    expect(isPlaybackVisible("SELECTED", "episode", "series-selected", selected)).toBe(true);
    expect(isPlaybackVisible("SELECTED", "movie-private", null, selected)).toBe(false);
  });

  it("never shares playback in NONE mode", () => {
    expect(isPlaybackVisible("NONE", "movie-selected", null, selected)).toBe(false);
  });
});

describe("watch history privacy", () => {
  const selected = new Set(["movie-selected", "series-selected"]);

  it("shares every history item in ALL mode", () => {
    expect(isHistoryItemVisible("ALL", "movie-other", null, selected)).toBe(true);
  });

  it("shares a selected movie or an episode from a selected series", () => {
    expect(isHistoryItemVisible("SELECTED", "movie-selected", null, selected)).toBe(true);
    expect(isHistoryItemVisible("SELECTED", "episode", "series-selected", selected)).toBe(true);
    expect(isHistoryItemVisible("SELECTED", "movie-private", null, selected)).toBe(false);
  });

  it("never exposes history in live-only or private modes", () => {
    expect(isHistoryItemVisible("ONLY_WATCHING", "movie-selected", null, selected)).toBe(false);
    expect(isHistoryItemVisible("NONE", "movie-selected", null, selected)).toBe(false);
  });
});
