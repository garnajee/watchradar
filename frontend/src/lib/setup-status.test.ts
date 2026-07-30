import { describe, expect, it } from "vitest";
import { getConfigurationWarningKey } from "./setup-status";

describe("login configuration warning", () => {
  it("stays hidden once both Jellyfin settings are configured", () => {
    expect(
      getConfigurationWarningKey(
        { ready: true, jellyfinUrlConfigured: true, apiKeyConfigured: true },
        false
      )
    ).toBeNull();
  });

  it("explains how to configure a missing Jellyfin URL", () => {
    expect(
      getConfigurationWarningKey(
        { ready: false, jellyfinUrlConfigured: false, apiKeyConfigured: false },
        false
      )
    ).toBe("setup.missingUrl");
  });

  it("directs an administrator to configure a missing API key", () => {
    expect(
      getConfigurationWarningKey(
        { ready: false, jellyfinUrlConfigured: true, apiKeyConfigured: false },
        false
      )
    ).toBe("setup.missingApiKey");
  });

  it("shows a warning when status cannot be checked", () => {
    expect(getConfigurationWarningKey(null, true)).toBe("setup.checkFailed");
  });
});
