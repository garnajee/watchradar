import { describe, expect, it } from "vitest";
import { encryptValue } from "../lib/crypto.js";
import { resolveConfiguredJellyfinValues } from "./configured-client.js";

const encryptionKey = "c".repeat(64);

describe("configured Jellyfin values", () => {
  it("uses optional environment bootstrap values when the database is empty", () => {
    expect(
      resolveConfiguredJellyfinValues(null, {
        encryptionKey,
        jellyfinUrl: "https://jellyfin.bootstrap.test",
        jellyfinApiKey: "bootstrap-api-key"
      })
    ).toEqual({
      url: "https://jellyfin.bootstrap.test",
      apiKey: "bootstrap-api-key"
    });
  });

  it("prefers the encrypted database configuration after it is saved in the UI", () => {
    expect(
      resolveConfiguredJellyfinValues(
        {
          jellyfinUrl: "https://jellyfin.saved.test",
          encryptedApiKey: encryptValue("saved-api-key", encryptionKey)
        },
        {
          encryptionKey,
          jellyfinUrl: "https://jellyfin.bootstrap.test",
          jellyfinApiKey: "bootstrap-api-key"
        }
      )
    ).toEqual({
      url: "https://jellyfin.saved.test",
      apiKey: "saved-api-key"
    });
  });

  it("requires both a URL and an API key before creating a server client", () => {
    expect(() =>
      resolveConfiguredJellyfinValues(null, {
        encryptionKey,
        jellyfinUrl: "",
        jellyfinApiKey: ""
      })
    ).toThrowError(expect.objectContaining({ code: "SETUP_REQUIRED" }));

    expect(() =>
      resolveConfiguredJellyfinValues(null, {
        encryptionKey,
        jellyfinUrl: "https://jellyfin.test",
        jellyfinApiKey: ""
      })
    ).toThrowError(expect.objectContaining({ code: "SETUP_REQUIRED" }));
  });
});
