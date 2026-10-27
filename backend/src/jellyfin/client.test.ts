import { describe, expect, it } from "vitest";
import { jellyfinAuthorizationHeader, normalizeJellyfinUrl } from "./client.js";

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

describe("Jellyfin authorization header", () => {
  it("sends the API key in the MediaBrowser Authorization header", () => {
    const header = jellyfinAuthorizationHeader("0123456789abcdef0123456789abcdef");

    expect(header).toContain('Client="WatchRadar"');
    expect(header).toContain('Token="0123456789abcdef0123456789abcdef"');
  });

  it("omits the token when none is configured", () => {
    expect(jellyfinAuthorizationHeader()).not.toContain("Token=");
    expect(jellyfinAuthorizationHeader("   ")).not.toContain("Token=");
  });
});
