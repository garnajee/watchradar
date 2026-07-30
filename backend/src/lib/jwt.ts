import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AccessClaims = {
  userId: number;
  isAdmin: boolean;
  type: "access";
};

type RefreshClaims = {
  userId: number;
  type: "refresh";
  exp: number;
};

export function signAccessToken(userId: number, isAdmin: boolean): string {
  return jwt.sign({ userId, isAdmin, type: "access" } satisfies AccessClaims, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "15m",
    issuer: "watchradar",
    audience: "watchradar-web"
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign(
    { userId, type: "refresh" } satisfies Omit<RefreshClaims, "exp">,
    config.jwtRefreshSecret,
    {
      algorithm: "HS256",
      expiresIn: "30d",
      issuer: "watchradar",
      audience: "watchradar-web"
    }
  );
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, config.jwtSecret, {
    issuer: "watchradar",
    audience: "watchradar-web",
    algorithms: ["HS256"]
  });
  if (
    typeof payload === "string" ||
    payload.type !== "access" ||
    typeof payload.userId !== "number" ||
    typeof payload.isAdmin !== "boolean"
  ) {
    throw new Error("Invalid access token");
  }
  return payload as AccessClaims;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const payload = jwt.verify(token, config.jwtRefreshSecret, {
    issuer: "watchradar",
    audience: "watchradar-web",
    algorithms: ["HS256"]
  });
  if (
    typeof payload === "string" ||
    payload.type !== "refresh" ||
    typeof payload.userId !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid refresh token");
  }
  return payload as RefreshClaims;
}
