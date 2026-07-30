import type { JellyfinUser } from "../jellyfin/types.js";
import { prisma } from "../db.js";
import { invalidateAuthState } from "../middleware/auth.js";

export async function syncJellyfinUsers(users: JellyfinUser[]): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const jellyfinUser of users) {
      const siteUser = await transaction.siteUser.upsert({
        where: { jellyfinUserId: jellyfinUser.Id },
        create: {
          jellyfinUserId: jellyfinUser.Id,
          name: jellyfinUser.Name,
          avatarTag: jellyfinUser.PrimaryImageTag ?? null,
          isAdmin: Boolean(jellyfinUser.Policy?.IsAdministrator),
          isEnabled: false
        },
        update: {
          name: jellyfinUser.Name,
          avatarTag: jellyfinUser.PrimaryImageTag ?? null,
          isAdmin: Boolean(jellyfinUser.Policy?.IsAdministrator)
        }
      });
      await transaction.sharingPreference.upsert({
        where: { userId: siteUser.id },
        create: { userId: siteUser.id, shareMode: "ONLY_WATCHING" },
        update: {}
      });
      await transaction.visibilityMatrix.upsert({
        where: { viewerId_targetId: { viewerId: siteUser.id, targetId: siteUser.id } },
        create: { viewerId: siteUser.id, targetId: siteUser.id, canView: true },
        update: { canView: true }
      });
    }
  });
  invalidateAuthState();
}
