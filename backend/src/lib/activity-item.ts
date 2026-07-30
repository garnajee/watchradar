import type { JellyfinItem } from "../jellyfin/types.js";
import { signedMediaUrl } from "./media-url.js";

export function mediaImageUrl(
  viewerId: number,
  itemId: string,
  tag?: string | null
): string {
  return signedMediaUrl(viewerId, "item", itemId, tag);
}

export function serializeActivityItem(viewerId: number, item: JellyfinItem) {
  const isEpisode = item.Type === "Episode" && Boolean(item.SeriesId);
  const imageItemId = isEpisode ? item.SeriesId! : item.Id;
  const imageTag = isEpisode ? item.SeriesPrimaryImageTag : item.ImageTags?.Primary;
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  const runtime = item.RunTimeTicks ?? 0;

  return {
    id: item.Id,
    name: item.Name,
    type: item.Type,
    seriesId: item.SeriesId ?? null,
    seriesName: item.SeriesName ?? null,
    seasonNumber: item.ParentIndexNumber ?? null,
    episodeNumber: item.IndexNumber ?? null,
    progress:
      item.UserData?.PlayedPercentage ??
      (runtime > 0 ? Math.min(100, Math.round((position / runtime) * 10_000) / 100) : 0),
    played: Boolean(item.UserData?.Played),
    playCount: item.UserData?.PlayCount ?? 0,
    lastPlayedDate: item.UserData?.LastPlayedDate ?? null,
    imageUrl: mediaImageUrl(viewerId, imageItemId, imageTag)
  };
}
