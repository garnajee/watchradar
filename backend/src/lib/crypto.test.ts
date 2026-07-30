import { describe, expect, it } from "vitest";
import { decryptValue, encryptValue } from "./crypto.js";

describe("AES-256-GCM helpers", () => {
  const key = "a".repeat(64);

  it("round-trips a secret without storing it in clear text", () => {
    const encrypted = encryptValue("jellyfin-api-key", key);

    expect(encrypted).not.toContain("jellyfin-api-key");
    expect(decryptValue(encrypted, key)).toBe("jellyfin-api-key");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptValue("secret", key);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptValue(tampered, key)).toThrow();
  });
});
