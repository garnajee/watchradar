import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { appEvents } from "../events.js";
import { JellyfinClient, normalizeJellyfinUrl } from "../jellyfin/client.js";
import { invalidateConfiguredJellyfinClient } from "../jellyfin/configured-client.js";
import { ApiError } from "../lib/api-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { decryptValue } from "../lib/crypto.js";
import { signedMediaUrl } from "../lib/media-url.js";
import { signAccessToken, verifyRefreshToken } from "../lib/jwt.js";
import { REFRESH_SESSION_MAX_AGE_MS } from "../lib/refresh-token.js";
import { invalidateAuthState, requireAuth } from "../middleware/auth.js";
import {
  createRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  upgradeLegacyRefreshSession
} from "../services/auth-session.js";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(500),
  jellyfinUrl: z.string().trim().url().optional()
});

const cookieBase = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: "strict" as const
};

function setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
  response.cookie("access_token", accessToken, {
    ...cookieBase,
    path: "/api",
    maxAge: 15 * 60 * 1000
  });
  response.cookie("refresh_token", refreshToken, {
    ...cookieBase,
    path: "/api/auth",
    maxAge: REFRESH_SESSION_MAX_AGE_MS
  });
}

function publicUser(user: {
  id: number;
  name: string;
  jellyfinUserId: string;
  isAdmin: boolean;
  avatarTag: string | null;
  locale: string;
}) {
  return {
    id: user.id,
    name: user.name,
    jellyfinUserId: user.jellyfinUserId,
    isAdmin: user.isAdmin,
    locale: user.locale,
    avatarUrl: signedMediaUrl(user.id, "user", user.jellyfinUserId, user.avatarTag)
  };
}

export const authRouter = Router();

authRouter.get(
  "/status",
  asyncHandler(async (_request, response) => {
    const stored = await prisma.adminConfig.findUnique({ where: { id: 1 } });
    const jellyfinUrlConfigured = Boolean(stored?.jellyfinUrl || config.jellyfinUrl);
    let apiKeyConfigured = Boolean(config.jellyfinApiKey);
    if (stored?.encryptedApiKey) {
      try {
        apiKeyConfigured = decryptValue(stored.encryptedApiKey, config.encryptionKey).length > 0;
      } catch {
        apiKeyConfigured = false;
      }
    }
    response.json({
      ready: jellyfinUrlConfigured && apiKeyConfigured,
      jellyfinUrlConfigured,
      apiKeyConfigured
    });
  })
);

authRouter.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Trop de tentatives. Réessayez dans quinze minutes."
      }
    }
  }),
  asyncHandler(async (request, response) => {
    const body = loginSchema.parse(request.body);
    const storedConfig = await prisma.adminConfig.findUnique({ where: { id: 1 } });
    const rawUrl = storedConfig?.jellyfinUrl || config.jellyfinUrl || body.jellyfinUrl;
    if (!rawUrl) {
      throw new ApiError(
        412,
        "Configuration Jellyfin absente. Renseignez l'URL Jellyfin sur la page de connexion.",
        "SETUP_REQUIRED"
      );
    }
    const jellyfinUrl = normalizeJellyfinUrl(rawUrl);
    const client = new JellyfinClient(
      jellyfinUrl,
      undefined,
      config.jellyfinTlsRejectUnauthorized
    );
    const auth = await client.authenticate(body.username, body.password);
    const isAdmin = Boolean(auth.User.Policy?.IsAdministrator);
    const existing = await prisma.siteUser.findUnique({
      where: { jellyfinUserId: auth.User.Id }
    });

    if (!existing && !isAdmin) {
      throw new ApiError(403, "Ce compte n'est pas encore autorisé sur WatchRadar.", "USER_DISABLED");
    }
    if (existing && !existing.isEnabled && !isAdmin) {
      throw new ApiError(403, "Ce compte est désactivé sur WatchRadar.", "USER_DISABLED");
    }

    const user = await prisma.siteUser.upsert({
      where: { jellyfinUserId: auth.User.Id },
      create: {
        jellyfinUserId: auth.User.Id,
        name: auth.User.Name,
        avatarTag: auth.User.PrimaryImageTag ?? null,
        isAdmin,
        isEnabled: isAdmin
      },
      update: {
        name: auth.User.Name,
        avatarTag: auth.User.PrimaryImageTag ?? null,
        isAdmin,
        ...(isAdmin ? { isEnabled: true } : {})
      }
    });
    invalidateAuthState(user.id);
    await prisma.sharingPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, shareMode: "ONLY_WATCHING" },
      update: {}
    });
    await prisma.visibilityMatrix.upsert({
      where: { viewerId_targetId: { viewerId: user.id, targetId: user.id } },
      create: { viewerId: user.id, targetId: user.id, canView: true },
      update: { canView: true }
    });

    if (!storedConfig && isAdmin) {
      await prisma.adminConfig.create({ data: { id: 1, jellyfinUrl } });
      invalidateConfiguredJellyfinClient();
      appEvents.emit("jellyfin:config-changed");
    }

    const accessToken = signAccessToken(user.id, user.isAdmin);
    const refreshToken = await createRefreshSession(user.id);
    setAuthCookies(response, accessToken, refreshToken);
    response.json({ user: publicUser(user) });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (request, response) => {
    const token = request.cookies?.refresh_token as string | undefined;
    if (!token) throw new ApiError(401, "Session expirée.", "UNAUTHENTICATED");
    const rotated = await rotateRefreshSession(token);
    let user = rotated?.user;
    let refreshToken = rotated?.token;

    if (!user || !refreshToken) {
      // Transition douce depuis les anciens refresh tokens JWT valides pendant 30 jours.
      let legacyClaims: ReturnType<typeof verifyRefreshToken>;
      try {
        legacyClaims = verifyRefreshToken(token);
      } catch {
        throw new ApiError(401, "Session expirée.", "UNAUTHENTICATED");
      }
      const legacyUser = await prisma.siteUser.findUnique({
        where: { id: legacyClaims.userId }
      });
      if (!legacyUser?.isEnabled) {
        throw new ApiError(403, "Ce compte est désactivé.", "USER_DISABLED");
      }
      user = legacyUser;
      const upgradedToken = await upgradeLegacyRefreshSession(
        legacyUser.id,
        token,
        new Date(legacyClaims.exp * 1000)
      );
      if (!upgradedToken) {
        throw new ApiError(401, "Session expirée.", "UNAUTHENTICATED");
      }
      refreshToken = upgradedToken;
    }

    const accessToken = signAccessToken(user.id, user.isAdmin);
    setAuthCookies(response, accessToken, refreshToken);
    response.status(204).end();
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (request, response) => {
    const token = request.cookies?.refresh_token as string | undefined;
    if (token) await revokeRefreshSession(token);
    response.clearCookie("access_token", { ...cookieBase, path: "/api" });
    response.clearCookie("refresh_token", { ...cookieBase, path: "/api/auth" });
    response.status(204).end();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await prisma.siteUser.findUnique({ where: { id: request.auth!.userId } });
    if (!user?.isEnabled) throw new ApiError(403, "Ce compte est désactivé.", "USER_DISABLED");
    response.json({ user: publicUser(user) });
  })
);
