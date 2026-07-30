import { describe, expect, it } from "vitest";
import { normalizeJellyfinUrl } from "./client.js";

describe("Jellyfin URL normalization", () => {
  it("accepts HTTPS URLs and removes the final slash", () => {
    expect(normalizeJellyfinUrl("https://jellyfin.example.com/")).toBe(
      "https://jellyfin.example.com"
    );
    expect(normalizeJellyfinUrl("https://example.com/jellyfin/")).toBe(
      "https://example.com/jellyfin"
    );
  });

  it("rejects clear-text HTTP and URL credentials", () => {
    expect(() => normalizeJellyfinUrl("http://jellyfin.example.com")).toThrow();
    expect(() => normalizeJellyfinUrl("https://admin:secret@example.com")).toThrow();
  });

  it("rejects query strings and fragments", () => {
    expect(() => normalizeJellyfinUrl("https://example.com?redirect=other")).toThrow();
    expect(() => normalizeJellyfinUrl("https://example.com/#fragment")).toThrow();
  });
});
