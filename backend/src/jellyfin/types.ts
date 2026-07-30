export type JellyfinUser = {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  Policy?: {
    IsAdministrator?: boolean;
    IsDisabled?: boolean;
  };
};

export type JellyfinAuthenticationResult = {
  AccessToken: string;
  User: JellyfinUser;
};

export type JellyfinItem = {
  Id: string;
  Name: string;
  Type: string;
  SeriesId?: string;
  SeriesName?: string;
  SeriesPrimaryImageTag?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  RunTimeTicks?: number;
  ImageTags?: {
    Primary?: string;
  };
  UserData?: {
    Played?: boolean;
    PlayCount?: number;
    PlayedPercentage?: number;
    PlaybackPositionTicks?: number;
    LastPlayedDate?: string;
  };
};

export type JellyfinSession = {
  Id: string;
  UserId?: string;
  UserName?: string;
  NowPlayingItem?: JellyfinItem;
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
  };
};

export type JellyfinItemsResult = {
  Items: JellyfinItem[];
  TotalRecordCount?: number;
};
