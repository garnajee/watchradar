export type ShareMode = "ALL" | "NONE" | "ONLY_WATCHING" | "SELECTED";
export type Locale = "en" | "fr";

export type CurrentUser = {
  id: number;
  name: string;
  jellyfinUserId: string;
  isAdmin: boolean;
  locale: Locale;
  avatarUrl: string;
};

export type Playback = {
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
  playback: Playback | null;
};

export type ActivityItem = {
  id: string;
  name: string;
  type: string;
  seriesId: string | null;
  seriesName: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  progress: number;
  played: boolean;
  playCount: number;
  lastPlayedDate: string | null;
  imageUrl: string;
};

export type UserActivity = {
  user: DashboardUser;
  nextUp: ActivityItem[];
  resume: ActivityItem[];
  history: ActivityItem[];
};

export type SharedItem = {
  id: number;
  jellyfinItemId: string;
  itemType: string;
  name: string | null;
  imageTag: string | null;
};

export type LibraryItem = {
  id: string;
  name: string;
  type: "Movie" | "Series";
  imageTag: string | null;
  imageUrl: string;
};
