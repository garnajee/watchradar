import { describe, expect, it } from "vitest";
import { signedMediaUrl, verifyMediaSignature } from "./media-url.js";

function verificationInput(urlValue: string, viewerId = 12) {
  const url = new URL(urlValue, "https://watchradar.test");
  return {
    viewerId,
    kind: "item" as const,
    resourceId: "movie-42",
    tag: url.searchParams.get("tag") ?? undefined,
    expiresAt: url.searchParams.get("exp") ?? "",
    signature: url.searchParams.get("sig") ?? ""
  };
}

describe("signed media URLs", () => {
  const now = Date.UTC(2026, 6, 29, 12);

  it("authorizes the intended viewer and resource", () => {
    const url = signedMediaUrl(12, "item", "movie-42", "poster", now);
    expect(verifyMediaSignature({ ...verificationInput(url), now })).toBe(true);
  });

  it("rejects another viewer or a modified resource tag", () => {
    const url = signedMediaUrl(12, "item", "movie-42", "poster", now);
    expect(verifyMediaSignature({ ...verificationInput(url, 13), now })).toBe(false);
    expect(
      verifyMediaSignature({ ...verificationInput(url), tag: "other-poster", now })
    ).toBe(false);
  });

  it("rejects expired URLs", () => {
    const url = signedMediaUrl(12, "item", "movie-42", "poster", now);
    expect(
      verifyMediaSignature({
        ...verificationInput(url),
        now: now + 3 * 24 * 60 * 60 * 1000
      })
    ).toBe(false);
  });
});
