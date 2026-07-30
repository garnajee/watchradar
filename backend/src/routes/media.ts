import { Router, type Response } from "express";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { RemoteImage } from "../jellyfin/client.js";
import { getConfiguredJellyfinClient } from "../jellyfin/configured-client.js";
import { ApiError } from "../lib/api-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { verifyMediaSignature } from "../lib/media-url.js";
import { requireAuth } from "../middleware/auth.js";
import { mediaReadLimiter } from "../middleware/rate-limiters.js";

const itemIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
const mediaQuerySchema = z.object({
  tag: z.string().max(300).optional(),
  exp: z.string().regex(/^[0-9]{1,12}$/),
  sig: z.string().regex(/^[a-f0-9]{64}$/)
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.use(mediaReadLimiter);

async function sendImage(
  signatureInput: Parameters<typeof verifyMediaSignature>[0],
  response: Response,
  loadImage: () => Promise<RemoteImage>
): Promise<void> {
  if (!verifyMediaSignature(signatureInput)) {
    throw new ApiError(403, "URL d’image invalide ou expirée.", "INVALID_MEDIA_SIGNATURE");
  }
  const image = await loadImage();
  response.setHeader("Content-Type", image.contentType);
  response.setHeader("Cache-Control", "private, max-age=86400, immutable");
  response.setHeader("Content-Disposition", "inline");
  if (image.contentLength !== undefined) {
    response.setHeader("Content-Length", String(image.contentLength));
  }
  try {
    await pipeline(image.body, response);
  } catch (error) {
    image.body.destroy();
    if (!("destroyed" in response) || !response.destroyed) throw error;
  }
}

mediaRouter.get(
  "/items/:itemId/image",
  asyncHandler(async (request, response) => {
    const itemId = itemIdSchema.parse(request.params.itemId);
    const query = mediaQuerySchema.parse(request.query);
    await sendImage(
      {
        viewerId: request.auth!.userId,
        kind: "item",
        resourceId: itemId,
        ...(query.tag === undefined ? {} : { tag: query.tag }),
        expiresAt: query.exp,
        signature: query.sig
      },
      response,
      async () => {
        const { client } = await getConfiguredJellyfinClient();
        return client.getImage(itemId, query.tag);
      }
    );
  })
);

mediaRouter.get(
  "/users/:userId/avatar",
  asyncHandler(async (request, response) => {
    const userId = itemIdSchema.parse(request.params.userId);
    const query = mediaQuerySchema.parse(request.query);
    await sendImage(
      {
        viewerId: request.auth!.userId,
        kind: "user",
        resourceId: userId,
        ...(query.tag === undefined ? {} : { tag: query.tag }),
        expiresAt: query.exp,
        signature: query.sig
      },
      response,
      async () => {
        const { client } = await getConfiguredJellyfinClient();
        return client.getUserImage(userId, query.tag);
      }
    );
  })
);
