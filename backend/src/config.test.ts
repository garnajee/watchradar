import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PORT: "3000",
  DATABASE_URL: "postgresql://watchradar:test@db:5432/watchradar",
  JWT_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "b".repeat(64),
  ENCRYPTION_KEY: "c".repeat(64),
  FRONTEND_ORIGIN: "https://watchradar.test",
  COOKIE_SECURE: "true",
  TRUST_PROXY_HOPS: "1",
  JELLYFIN_TLS_REJECT_UNAUTHORIZED: "true",
  JELLYFIN_URL: "https://jellyfin.test",
  JELLYFIN_API_KEY: "",
  LOG_LEVEL: "info"
};

describe("environment configuration", () => {
  it("accepts the hardened production defaults", () => {
    expect(parseConfig(validEnvironment)).toMatchObject({
      nodeEnv: "production",
      cookieSecure: true,
      trustProxyHops: 1,
      jellyfinApiKey: ""
    });
  });

  it("accepts optional Jellyfin bootstrap settings", () => {
    expect(
      parseConfig({
        ...validEnvironment,
        JELLYFIN_URL: "",
        JELLYFIN_API_KEY: ""
      })
    ).toMatchObject({
      jellyfinUrl: "",
      jellyfinApiKey: ""
    });
    expect(
      parseConfig({
        ...validEnvironment,
        JELLYFIN_API_KEY: "jellyfin-api-key"
      })
    ).toMatchObject({
      jellyfinApiKey: "jellyfin-api-key"
    });
    expect(() =>
      parseConfig({
        ...validEnvironment,
        JELLYFIN_API_KEY: "short"
      })
    ).toThrow(/at least 8 character/);
  });

  it("requires HTTPS and secure cookies in production", () => {
    expect(() =>
      parseConfig({
        ...validEnvironment,
        FRONTEND_ORIGIN: "http://watchradar.test"
      })
    ).toThrow(/must use HTTPS in production/);
    expect(() =>
      parseConfig({
        ...validEnvironment,
        COOKIE_SECURE: "false"
      })
    ).toThrow(/must be true in production/);
  });

  it("rejects reused JWT secrets and origins containing a path", () => {
    expect(() =>
      parseConfig({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment.JWT_SECRET
      })
    ).toThrow(/must be different/);
    expect(() =>
      parseConfig({
        ...validEnvironment,
        FRONTEND_ORIGIN: "https://watchradar.test/app"
      })
    ).toThrow(/without a path/);
  });
});
