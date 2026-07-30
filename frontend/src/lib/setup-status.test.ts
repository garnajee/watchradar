import { describe, expect, it } from "vitest";
import { getConfigurationWarning } from "./setup-status";

describe("login configuration warning", () => {
  it("stays hidden once both Jellyfin settings are configured", () => {
    expect(
      getConfigurationWarning(
        { ready: true, jellyfinUrlConfigured: true, apiKeyConfigured: true },
        false
      )
    ).toBeNull();
  });

  it("explains how to configure a missing Jellyfin URL", () => {
    expect(
      getConfigurationWarning(
        { ready: false, jellyfinUrlConfigured: false, apiKeyConfigured: false },
        false
      )
    ).toContain("JELLYFIN_URL");
  });

  it("directs an administrator to configure a missing API key", () => {
    expect(
      getConfigurationWarning(
        { ready: false, jellyfinUrlConfigured: true, apiKeyConfigured: false },
        false
      )
    ).toContain("clé API");
  });

  it("shows a warning when status cannot be checked", () => {
    expect(getConfigurationWarning(null, true)).toContain("Impossible");
  });
});
