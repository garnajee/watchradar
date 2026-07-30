import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError } from "../lib/api-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { jellyfinReadLimiter } from "../middleware/rate-limiters.js";
import {
  getDashboardUser,
  getDashboardUsers,
  getUserActivity
} from "../services/activity.js";
import { dashboardStreamHub } from "../services/dashboard-stream.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/users",
  asyncHandler(async (request, response) => {
    response.json({ users: await getDashboardUsers(request.auth!.userId) });
  })
);

dashboardRouter.get(
  "/users/:id/activity",
  jellyfinReadLimiter,
  asyncHandler(async (request, response) => {
    const targetId = Number(request.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw new ApiError(400, "Identifiant invalide.", "VALIDATION_ERROR");
    }
    response.json(await getUserActivity(request.auth!.userId, targetId));
  })
);

dashboardRouter.put(
  "/users/:id/favorite",
  asyncHandler(async (request, response) => {
    const targetId = Number(request.params.id);
    const favorite = request.body?.favorite;
    if (!Number.isInteger(targetId) || typeof favorite !== "boolean") {
      throw new ApiError(400, "Données invalides.", "VALIDATION_ERROR");
    }
    const visible = await getDashboardUser(request.auth!.userId, targetId);
    if (!visible) throw new ApiError(404, "Utilisateur non visible.", "NOT_VISIBLE");
    if (favorite) {
      await prisma.userFavorite.upsert({
        where: {
          viewerId_targetId: { viewerId: request.auth!.userId, targetId }
        },
        create: { viewerId: request.auth!.userId, targetId },
        update: {}
      });
    } else {
      await prisma.userFavorite.deleteMany({
        where: { viewerId: request.auth!.userId, targetId }
      });
    }
    response.json({ favorite });
  })
);

dashboardRouter.get("/stream", (request, response) => {
  const viewerId = request.auth!.userId;
  if (!dashboardStreamHub.canConnect(viewerId)) {
    throw new ApiError(429, "Trop de connexions temps réel.", "TOO_MANY_STREAMS");
  }
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.flushHeaders();
  const close = dashboardStreamHub.connect(viewerId, response);
  request.once("close", close);
});
