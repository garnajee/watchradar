import { describe, expect, it } from "vitest";
import {
  generateRefreshToken,
  hashRefreshToken,
  MAX_REFRESH_SESSIONS_PER_USER,
  REFRESH_SESSION_MAX_AGE_MS,
  refreshSessionExpiresAt
} from "./refresh-token.js";

describe("refresh sessions", () => {
  it("generates independent 256-bit opaque tokens", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
  });

  it("stores only a deterministic SHA-256 digest", () => {
    const token = generateRefreshToken();
    const digest = hashRefreshToken(token);

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(token)).toBe(digest);
    expect(digest).not.toContain(token);
  });

  it("uses a bounded 180-day sliding lifetime", () => {
    const now = Date.UTC(2026, 6, 30);

    expect(refreshSessionExpiresAt(now).getTime() - now).toBe(REFRESH_SESSION_MAX_AGE_MS);
    expect(MAX_REFRESH_SESSIONS_PER_USER).toBe(10);
  });
});
