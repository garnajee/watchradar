import { createHash, randomBytes } from "node:crypto";

export const REFRESH_SESSION_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export const MAX_REFRESH_SESSIONS_PER_USER = 10;

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function refreshSessionExpiresAt(now = Date.now()): Date {
  return new Date(now + REFRESH_SESSION_MAX_AGE_MS);
}
