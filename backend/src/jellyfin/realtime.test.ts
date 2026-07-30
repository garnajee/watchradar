import { describe, expect, it } from "vitest";
import { safeErrorMessage } from "./realtime.js";

describe("safeErrorMessage", () => {
  it("removes Jellyfin API keys from WebSocket errors", () => {
    const message = safeErrorMessage(
      new Error("connect wss://jellyfin.test/socket?api_key=server-secret&deviceId=watchradar")
    );

    expect(message).toBe(
      "connect wss://jellyfin.test/socket?api_key=[redacted]&deviceId=watchradar"
    );
    expect(message).not.toContain("server-secret");
  });
});
