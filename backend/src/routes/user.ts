import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { getConfiguredJellyfinClient } from "../jellyfin/configured-client.js";
import { ApiError } from "../lib/api-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { signedMediaUrl } from "../lib/media-url.js";
import { requireAuth } from "../middleware/auth.js";
import { jellyfinReadLimiter } from "../middleware/rate-limiters.js";

const modeSchema = z.object({
  shareMode: z.enum(["ALL", "NONE", "ONLY_WATCHING", "SELECTED"])
});
const sharedItemSchema = z.object({
  jellyfinItemId: z.string().min(1).max(100),
  itemType: z.enum(["Movie", "Series"]),
  name: z.string().max(300).optional(),
  imageTag: z.string().max(300).optional(),
  selected: z.boolean()
});

export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get(
  "/preferences",
  asyncHandler(async (request, response) => {
    const user = await prisma.siteUser.findUniqueOrThrow({
      where: { id: request.auth!.userId },
      include: { sharingPreference: true, sharedItems: true }
    });
    response.json({
      shareMode: user.sharingPreference?.shareMode ?? "ONLY_WATCHING",
      sharedItems: user.sharedItems
    });
  })
);

userRouter.put(
  "/preferences",
  asyncHandler(async (request, response) => {
    const body = modeSchema.parse(request.body);
    const preference = await prisma.sharingPreference.upsert({
      where: { userId: request.auth!.userId },
      create: { userId: request.auth!.userId, shareMode: body.shareMode },
      update: { shareMode: body.shareMode }
    });
    response.json({ shareMode: preference.shareMode });
  })
);

userRouter.get(
  "/library",
  jellyfinReadLimiter,
  asyncHandler(async (request, response) => {
    const search =
      typeof request.query.search === "string" ? request.query.search.trim().slice(0, 100) : "";
    const user = await prisma.siteUser.findUnique({ where: { id: request.auth!.userId } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    const { client } = await getConfiguredJellyfinClient();
    const result = await client.getLibrary(user.jellyfinUserId, search);
    response.json({
      items: result.Items.map((item) => ({
        id: item.Id,
        name: item.Name,
        type: item.Type,
        imageTag: item.ImageTags?.Primary ?? null,
        imageUrl: signedMediaUrl(
          request.auth!.userId,
          "item",
          item.Id,
          item.ImageTags?.Primary
        )
      }))
    });
  })
);

userRouter.post(
  "/shared-items",
  asyncHandler(async (request, response) => {
    const body = sharedItemSchema.parse(request.body);
    const userId = request.auth!.userId;
    if (body.selected) {
      await prisma.sharedItem.upsert({
        where: { userId_jellyfinItemId: { userId, jellyfinItemId: body.jellyfinItemId } },
        create: {
          userId,
          jellyfinItemId: body.jellyfinItemId,
          itemType: body.itemType,
          name: body.name ?? null,
          imageTag: body.imageTag ?? null
        },
        update: {
          itemType: body.itemType,
          name: body.name ?? null,
          imageTag: body.imageTag ?? null
        }
      });
    } else {
      await prisma.sharedItem.deleteMany({
        where: { userId, jellyfinItemId: body.jellyfinItemId }
      });
    }
    response.status(body.selected ? 201 : 200).json({ selected: body.selected });
  })
);
