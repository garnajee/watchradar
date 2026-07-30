import type { PlaybackState, ShareMode } from "@prisma/client";
import { prisma } from "../db.js";
import { getConfiguredJellyfinClient } from "../jellyfin/configured-client.js";
import type { JellyfinItem } from "../jellyfin/types.js";
import { mediaImageUrl, serializeActivityItem } from "../lib/activity-item.js";
import { ApiError } from "../lib/api-error.js";
import { signedMediaUrl } from "../lib/media-url.js";
import { isHistoryItemVisible, isPlaybackVisible } from "../lib/privacy.js";

export type PublicPlayback = {
  itemId: string;
  itemName: string;
  itemType: string;
  seriesName: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  imageUrl: string;
  positionTicks: string;
  runtimeTicks: string;
  progress: number;
  isPlaying: boolean;
  lastUpdated: string;
};

export type DashboardUser = {
  id: number;
  name: string;
  jellyfinUserId: string;
  avatarUrl: string;
  shareMode: ShareMode;
  isFavorite: boolean;
  playback: PublicPlayback | null;
};

function serializePlayback(
  viewerId: number,
  playback: NonNullable<
    Awaited<ReturnType<typeof prisma.playbackState.findUnique>>
  >
): PublicPlayback | null {
  if (!playback.itemId || !playback.itemName || !playback.itemType) return null;
  const position = playback.positionTicks ?? 0n;
  const runtime = playback.runtimeTicks ?? 0n;
  return {
    itemId: playback.itemId,
    itemName: playback.itemName,
    itemType: playback.itemType,
    seriesName: playback.seriesName,
    seasonNumber: playback.seasonNumber,
    episodeNumber: playback.episodeNumber,
    imageUrl: mediaImageUrl(viewerId, playback.itemId, playback.imageTag),
    positionTicks: position.toString(),
    runtimeTicks: runtime.toString(),
    progress: runtime > 0n ? Math.min(100, Number((position * 10_000n) / runtime) / 100) : 0,
    isPlaying: playback.isPlaying,
    lastUpdated: playback.lastUpdated.toISOString()
  };
}

type DashboardTarget = {
  id: number;
  name: string;
  jellyfinUserId: string;
  avatarTag: string | null;
  sharingPreference: { shareMode: ShareMode } | null;
  sharedItems: Array<{ jellyfinItemId: string }>;
  playbackState: PlaybackState | null;
  favoritesReceived: Array<{ id: number }>;
};

function serializeDashboardTarget(viewerId: number, target: DashboardTarget): DashboardUser {
  const shareMode = target.sharingPreference?.shareMode ?? "ONLY_WATCHING";
  const selectedIds = new Set(target.sharedItems.map((item) => item.jellyfinItemId));
  const playback = isPlaybackVisible(
    shareMode,
    target.playbackState?.itemId ?? null,
    target.playbackState?.seriesId ?? null,
    selectedIds
  )
    ? serializePlayback(viewerId, target.playbackState!)
    : null;

  return {
    id: target.id,
    name: target.name,
    jellyfinUserId: target.jellyfinUserId,
    avatarUrl: signedMediaUrl(
      viewerId,
      "user",
      target.jellyfinUserId,
      target.avatarTag
    ),
    shareMode,
    isFavorite: target.favoritesReceived.length > 0,
    playback
  };
}

export async function getDashboardUser(
  viewerId: number,
  targetId: number
): Promise<DashboardUser | null> {
  const target = await prisma.siteUser.findFirst({
    where: {
      id: targetId,
      isEnabled: true,
      OR: [
        { id: viewerId },
        { visibilityReceived: { some: { viewerId, canView: true } } }
      ]
    },
    include: {
      sharingPreference: true,
      sharedItems: true,
      playbackState: true,
      favoritesReceived: { where: { viewerId } }
    }
  });
  if (!target) return null;

  return serializeDashboardTarget(viewerId, target);
}

export async function getDashboardUsers(viewerId: number): Promise<DashboardUser[]> {
  const targets = await prisma.siteUser.findMany({
    where: {
      isEnabled: true,
      OR: [
        { id: viewerId },
        { visibilityReceived: { some: { viewerId, canView: true } } }
      ]
    },
    include: {
      sharingPreference: true,
      sharedItems: true,
      playbackState: true,
      favoritesReceived: { where: { viewerId } }
    },
    orderBy: { name: "asc" }
  });
  return targets.map((target) => serializeDashboardTarget(viewerId, target));
}

export async function getUserActivity(viewerId: number, targetId: number) {
  const summary = await getDashboardUser(viewerId, targetId);
  if (!summary) {
    throw new ApiError(404, "Utilisateur introuvable ou non visible.", "NOT_VISIBLE");
  }
  const target = await prisma.siteUser.findUniqueOrThrow({
    where: { id: targetId },
    include: { sharingPreference: true, sharedItems: true }
  });
  const shareMode = target.sharingPreference?.shareMode ?? "ONLY_WATCHING";
  if (shareMode === "NONE" || shareMode === "ONLY_WATCHING") {
    return { user: summary, nextUp: [], resume: [], history: [] };
  }

  const { client } = await getConfiguredJellyfinClient();
  const [nextUpResult, resumeResult, historyResult] = await Promise.all([
    client.getNextUp(target.jellyfinUserId),
    client.getResumeItems(target.jellyfinUserId),
    client.getPlayHistory(target.jellyfinUserId)
  ]);
  const selectedIds = new Set(target.sharedItems.map((item) => item.jellyfinItemId));
  const allowed = (item: JellyfinItem) =>
    isHistoryItemVisible(shareMode, item.Id, item.SeriesId ?? null, selectedIds);
  const nextUp = nextUpResult.Items.filter(allowed).slice(0, 18);
  const nextUpSeriesIds = new Set(
    nextUp.map((item) => item.SeriesId).filter((id): id is string => Boolean(id))
  );
  const resume = resumeResult.Items.filter(allowed)
    .filter((item) => !item.SeriesId || !nextUpSeriesIds.has(item.SeriesId))
    .slice(0, 18);
  const history = historyResult.Items.filter(allowed).slice(0, 24);

  return {
    user: summary,
    nextUp: nextUp.map((item) => serializeActivityItem(viewerId, item)),
    resume: resume.map((item) => serializeActivityItem(viewerId, item)),
    history: history.map((item) => serializeActivityItem(viewerId, item))
  };
}
