import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { appEvents } from "../events.js";
import { JellyfinClient, normalizeJellyfinUrl } from "../jellyfin/client.js";
import {
  getConfiguredJellyfinClient,
  invalidateConfiguredJellyfinClient
} from "../jellyfin/configured-client.js";
import { ApiError } from "../lib/api-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { encryptValue } from "../lib/crypto.js";
import { signedMediaUrl } from "../lib/media-url.js";
import { invalidateAuthState, requireAdmin, requireAuth } from "../middleware/auth.js";
import { syncJellyfinUsers } from "../services/user-sync.js";

const configSchema = z.object({
  jellyfinUrl: z.string().url(),
  apiKey: z.string().trim().min(8).max(500)
});
const toggleSchema = z.object({ enabled: z.boolean().optional() });
const visibilitySchema = z.object({
  entries: z
    .array(
      z.object({
        viewerId: z.number().int().positive(),
        targetId: z.number().int().positive(),
        canView: z.boolean()
      })
    )
    .max(10_000)
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/config",
  asyncHandler(async (_request, response) => {
    const stored = await prisma.adminConfig.findUnique({ where: { id: 1 } });
    response.json({
      jellyfinUrl: stored?.jellyfinUrl || config.jellyfinUrl,
      configured: Boolean(stored?.encryptedApiKey || config.jellyfinApiKey)
    });
  })
);

adminRouter.post(
  "/config",
  asyncHandler(async (request, response) => {
    const body = configSchema.parse(request.body);
    const jellyfinUrl = normalizeJellyfinUrl(body.jellyfinUrl);
    const client = new JellyfinClient(
      jellyfinUrl,
      body.apiKey,
      config.jellyfinTlsRejectUnauthorized
    );
    const users = await client.getUsers();
    await prisma.adminConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        jellyfinUrl,
        encryptedApiKey: encryptValue(body.apiKey, config.encryptionKey)
      },
      update: {
        jellyfinUrl,
        encryptedApiKey: encryptValue(body.apiKey, config.encryptionKey)
      }
    });
    invalidateConfiguredJellyfinClient();
    appEvents.emit("jellyfin:config-changed");
    await syncJellyfinUsers(users);
    response.json({ jellyfinUrl, configured: true, syncedUsers: users.length });
  })
);

adminRouter.post(
  "/sync",
  asyncHandler(async (_request, response) => {
    const { client } = await getConfiguredJellyfinClient();
    const users = await client.getUsers();
    await syncJellyfinUsers(users);
    response.json({ syncedUsers: users.length });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (request, response) => {
    const users = await prisma.siteUser.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        jellyfinUserId: true,
        name: true,
        avatarTag: true,
        isEnabled: true,
        isAdmin: true
      }
    });
    response.json({
      users: users.map((user) => ({
        ...user,
        avatarUrl: signedMediaUrl(
          request.auth!.userId,
          "user",
          user.jellyfinUserId,
          user.avatarTag
        )
      }))
    });
  })
);

adminRouter.put(
  "/users/:jellyfinId/toggle",
  asyncHandler(async (request, response) => {
    const body = toggleSchema.parse(request.body);
    const jellyfinId = z.string().min(1).parse(request.params.jellyfinId);
    const user = await prisma.siteUser.findUnique({
      where: { jellyfinUserId: jellyfinId }
    });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    const enabled = body.enabled ?? !user.isEnabled;
    const updated = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.siteUser.update({
        where: { id: user.id },
        data: { isEnabled: enabled }
      });
      if (!enabled) {
        await transaction.authSession.deleteMany({ where: { userId: user.id } });
      }
      return changed;
    });
    invalidateAuthState(updated.id);
    if (enabled) {
      await prisma.visibilityMatrix.upsert({
        where: { viewerId_targetId: { viewerId: user.id, targetId: user.id } },
        create: { viewerId: user.id, targetId: user.id, canView: true },
        update: { canView: true }
      });
    }
    response.json({ user: updated });
  })
);

adminRouter.get(
  "/visibility",
  asyncHandler(async (_request, response) => {
    const [users, entries] = await Promise.all([
      prisma.siteUser.findMany({
        where: { isEnabled: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      prisma.visibilityMatrix.findMany()
    ]);
    response.json({ users, entries });
  })
);

adminRouter.put(
  "/visibility",
  asyncHandler(async (request, response) => {
    const body = visibilitySchema.parse(request.body);
    const enabledUsers = await prisma.siteUser.findMany({
      where: { isEnabled: true },
      select: { id: true }
    });
    const enabledIds = new Set(enabledUsers.map((user) => user.id));
    const entries = [...new Map(
      body.entries.map((entry) => [`${entry.viewerId}:${entry.targetId}`, entry])
    ).values()];
    if (
      entries.some(
        (entry) => !enabledIds.has(entry.viewerId) || !enabledIds.has(entry.targetId)
      )
    ) {
      throw new ApiError(
        400,
        "La matrice contient un utilisateur inactif ou inconnu.",
        "VALIDATION_ERROR"
      );
    }
    await prisma.$transaction(
      entries.map((entry) => {
        const canView = entry.viewerId === entry.targetId ? true : entry.canView;
        return prisma.visibilityMatrix.upsert({
          where: {
            viewerId_targetId: { viewerId: entry.viewerId, targetId: entry.targetId }
          },
          create: { ...entry, canView },
          update: { canView }
        });
      })
    );
    response.json({ updated: entries.length });
  })
);
