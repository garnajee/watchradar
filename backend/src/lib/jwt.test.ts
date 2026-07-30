import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from "./jwt.js";

describe("JWT helpers", () => {
  it("keeps access and refresh token types separated", () => {
    const access = signAccessToken(7, true);
    const refresh = signRefreshToken(7);
    expect(verifyAccessToken(access)).toMatchObject({ userId: 7, isAdmin: true, type: "access" });
    expect(verifyRefreshToken(refresh)).toMatchObject({ userId: 7, type: "refresh" });
    expect(() => verifyAccessToken(refresh)).toThrow();
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it("rejects a token signed with another HMAC algorithm", () => {
    const token = jwt.sign(
      { userId: 7, isAdmin: false, type: "access" },
      config.jwtSecret,
      {
        algorithm: "HS384",
        expiresIn: "15m",
        issuer: "watchradar",
        audience: "watchradar-web"
      }
    );
    expect(() => verifyAccessToken(token)).toThrow();
  });
});
