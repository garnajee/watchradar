import { describe, expect, it } from "vitest";
import { serializeActivityItem } from "./activity-item.js";

describe("activity item serialization", () => {
  it("uses the series poster and episode coordinates for an episode", () => {
    const item = serializeActivityItem(7, {
      Id: "episode-14",
      Name: "Le grand départ",
      Type: "Episode",
      SeriesId: "series-12",
      SeriesName: "Une série",
      SeriesPrimaryImageTag: "poster-tag",
      ParentIndexNumber: 12,
      IndexNumber: 14,
      RunTimeTicks: 10_000,
      UserData: { PlaybackPositionTicks: 2_500 }
    });

    expect(item.seriesName).toBe("Une série");
    expect(item.seasonNumber).toBe(12);
    expect(item.episodeNumber).toBe(14);
    expect(item.progress).toBe(25);
    expect(item.imageUrl).toMatch(
      /^\/media\/items\/series-12\/image\?exp=\d+&sig=[a-f0-9]{64}&tag=poster-tag$/
    );
  });

  it("keeps a movie poster and played metadata", () => {
    const item = serializeActivityItem(7, {
      Id: "movie-1",
      Name: "Un film",
      Type: "Movie",
      ImageTags: { Primary: "movie-tag" },
      UserData: {
        Played: true,
        PlayCount: 2,
        LastPlayedDate: "2026-07-28T12:00:00Z"
      }
    });

    expect(item.played).toBe(true);
    expect(item.playCount).toBe(2);
    expect(item.imageUrl).toMatch(
      /^\/media\/items\/movie-1\/image\?exp=\d+&sig=[a-f0-9]{64}&tag=movie-tag$/
    );
  });
});
