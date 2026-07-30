import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { ApiError } from "../lib/api-error.js";
import { verifyAccessToken } from "../lib/jwt.js";

const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX_ENTRIES = 1_000;
type AuthState = { isEnabled: boolean; isAdmin: boolean };
const authStateCache = new Map<number, { state: AuthState | null; expiresAt: number }>();

export function invalidateAuthState(userId?: number): void {
  if (userId === undefined) authStateCache.clear();
  else authStateCache.delete(userId);
}

async function getAuthState(userId: number): Promise<AuthState | null> {
  const now = Date.now();
  const cached = authStateCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.state;
  if (cached) authStateCache.delete(userId);

  const state = await prisma.siteUser.findUnique({
    where: { id: userId },
    select: { isEnabled: true, isAdmin: true }
  });
  if (authStateCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldestKey = authStateCache.keys().next().value as number | undefined;
    if (oldestKey !== undefined) authStateCache.delete(oldestKey);
  }
  authStateCache.set(userId, { state, expiresAt: now + AUTH_CACHE_TTL_MS });
  return state;
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : (request.cookies?.access_token as string | undefined);

  if (!token) {
    next(new ApiError(401, "Authentification requise.", "UNAUTHENTICATED"));
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    void getAuthState(claims.userId)
      .then((state) => {
        if (!state?.isEnabled) {
          next(new ApiError(401, "Compte désactivé.", "UNAUTHENTICATED"));
          return;
        }
        request.auth = { userId: claims.userId, isAdmin: state.isAdmin };
        next();
      })
      .catch(next);
  } catch {
    next(new ApiError(401, "Session expirée.", "TOKEN_EXPIRED"));
  }
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction): void {
  if (!request.auth?.isAdmin) {
    next(new ApiError(403, "Droits administrateur requis.", "FORBIDDEN"));
    return;
  }
  next();
}
