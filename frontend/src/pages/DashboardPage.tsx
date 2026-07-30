import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EyeOff,
  Heart,
  History,
  ListVideo,
  Play,
  Radio,
  RotateCcw,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { MediaImage } from "../components/MediaImage";
import { useI18n } from "../context/I18nContext";
import { API_URL, apiFetch } from "../lib/api";
import { localizedError } from "../lib/error-message";
import { formatDuration, formatEpisode } from "../lib/format";
import type { ActivityItem, DashboardUser, UserActivity } from "../types";

type ActivityShelfKind = "nextUp" | "resume" | "history";

function storedShelfState(kind: ActivityShelfKind): boolean {
  try {
    return window.localStorage.getItem(`watchradar.shelf.${kind}`) === "collapsed";
  } catch {
    return false;
  }
}

function storeShelfState(kind: ActivityShelfKind, collapsed: boolean): void {
  try {
    window.localStorage.setItem(
      `watchradar.shelf.${kind}`,
      collapsed ? "collapsed" : "expanded"
    );
  } catch {
    // Collapsing still works for the current visit when storage is unavailable.
  }
}

function LiveCard({ user }: { user: DashboardUser }) {
  const { t } = useI18n();
  const episodeUnits = {
    season: t("common.units.season"),
    episode: t("common.units.episode")
  };
  const durationUnits = {
    hour: t("common.units.hour"),
    minute: t("common.units.minute")
  };
  const playback = user.playback;
  if (!playback) {
    return (
      <div className="card flex min-h-48 items-center justify-center overflow-hidden p-6">
        <div className="text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-muted">
            <Radio className="h-5 w-5" />
          </span>
          <p className="font-medium text-white">{t("dashboard.nothingPlaying")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("dashboard.offlineNow", { name: user.name })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card relative min-h-64 overflow-hidden">
      <MediaImage
        src={playback.imageUrl}
        alt={playback.itemName}
        className="absolute inset-0 h-full w-full opacity-35 blur-[2px]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f1b] via-[#0b0f1b]/90 to-[#0b0f1b]/45" />
      <div className="relative flex h-full min-h-64 flex-col justify-end p-6 sm:p-8">
        <div className="mb-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-coral/20 bg-coral/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.16em] text-red-200">
            <span
              className={`h-2 w-2 rounded-full bg-coral ${playback.isPlaying ? "animate-pulse-soft" : ""}`}
            />
            {playback.isPlaying ? t("dashboard.live") : t("dashboard.paused")}
          </span>
          <Play className="h-8 w-8 text-white/30" fill="currentColor" />
        </div>
        {playback.seriesName && (
          <p className="mb-1 text-sm font-medium text-cyan">{playback.seriesName}</p>
        )}
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {playback.itemName}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          {(playback.seasonNumber !== null || playback.episodeNumber !== null) && (
            <span>
              {formatEpisode(
                playback.seasonNumber,
                playback.episodeNumber,
                episodeUnits
              )}
            </span>
          )}
          <span>
            {formatDuration(playback.positionTicks, durationUnits)} /{" "}
            {formatDuration(playback.runtimeTicks, durationUnits)}
          </span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-700"
            style={{ width: `${playback.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ActivityShelf({
  title,
  items,
  empty,
  kind
}: {
  title: string;
  items: ActivityItem[];
  empty: string;
  kind: ActivityShelfKind;
}) {
  const { locale, t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => storedShelfState(kind));
  const contentId = `activity-shelf-${kind}`;
  const episodeUnits = {
    season: t("common.units.season"),
    episode: t("common.units.episode")
  };
  const sectionIcon = {
    nextUp: ListVideo,
    resume: RotateCcw,
    history: History
  }[kind];
  const SectionIcon = sectionIcon;
  const ToggleIcon = collapsed ? ChevronDown : ChevronUp;

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      storeShelfState(kind, next);
      return next;
    });
  }

  return (
    <section className="mt-8">
      <div className={`flex items-center justify-between gap-4 ${collapsed ? "" : "mb-4"}`}>
        <h2 className="min-w-0 text-lg font-semibold text-white">
          <button
            type="button"
            className="-ml-2 flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            aria-label={t(
              collapsed ? "dashboard.expandSection" : "dashboard.collapseSection",
              { title }
            )}
            onClick={toggleCollapsed}
          >
            <SectionIcon className="h-5 w-5 shrink-0 text-cyan" />
            <span className="truncate">{title}</span>
            <ToggleIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </h2>
        <span className="text-xs text-muted">
          {t(
            items.length === 1
              ? "common.counts.titleOne"
              : "common.counts.titleOther",
            { count: items.length }
          )}
        </span>
      </div>
      <div id={contentId} hidden={collapsed}>
        {!collapsed &&
          (items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 px-6 py-9 text-center text-sm text-muted">
              {empty}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,112px))] justify-start gap-3">
              {items.map((item) => (
                <article key={item.id} className="group min-w-0">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-panel shadow-card">
                    <MediaImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full transition duration-500 group-hover:scale-105"
                    />
                    {item.progress > 0 && (
                      <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded bg-black/50">
                        <div
                          className="h-full bg-cyan"
                          style={{ width: `${Math.min(100, item.progress)}%` }}
                        />
                      </div>
                    )}
                    {item.seriesName &&
                      (item.seasonNumber !== null || item.episodeNumber !== null) && (
                        <span className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
                          {formatEpisode(
                            item.seasonNumber,
                            item.episodeNumber,
                            episodeUnits
                          )}
                        </span>
                      )}
                  </div>
                  <h3 className="mt-3 truncate text-sm font-medium text-white">
                    {item.seriesName ?? item.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
                    {item.seriesName
                      ? `${formatEpisode(
                          item.seasonNumber,
                          item.episodeNumber,
                          episodeUnits
                        )} · ${item.name}`
                      : kind === "resume" && item.progress > 0
                        ? t("dashboard.movieProgress", {
                            percent: Math.round(item.progress)
                          })
                        : kind === "history" && item.lastPlayedDate
                          ? t("dashboard.watchedOn", {
                              date: new Date(item.lastPlayedDate).toLocaleDateString(
                                locale === "fr" ? "fr-FR" : "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                }
                              )
                            })
                          : t("common.movie")}
                  </p>
                </article>
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const touchStart = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const playbackItemByUser = useRef(new Map<number, string | null>());

  const loadUsers = useCallback(async () => {
    const payload = await apiFetch<{ users: DashboardUser[] }>("/dashboard/users");
    playbackItemByUser.current = new Map(
      payload.users.map((user) => [user.id, user.playback?.itemId ?? null])
    );
    setUsers(payload.users);
    setSelectedId((current) =>
      current && payload.users.some((user) => user.id === current)
        ? current
        : (payload.users.find((user) => user.isFavorite)?.id ?? payload.users[0]?.id ?? null)
    );
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    void loadUsers()
      .catch((caught) => setError(localizedError(caught, t, "errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [loadUsers, t]);

  useEffect(() => {
    if (!selectedId) {
      setActivity(null);
      return;
    }
    const controller = new AbortController();
    setActivity(null);
    void apiFetch<UserActivity>(`/dashboard/users/${selectedId}/activity`, {
      signal: controller.signal
    })
      .then((payload) => {
        if (!controller.signal.aborted && payload.user.id === selectedId) {
          playbackItemByUser.current.set(
            payload.user.id,
            payload.user.playback?.itemId ?? null
          );
          setActivity(payload);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(localizedError(caught, t, "errors.activityUnavailable"));
        }
      });
    return () => controller.abort();
  }, [selectedId, t]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let reconnecting = false;
    let retryDelay = 2_000;
    let stopped = false;
    let activityRefreshTimer: number | null = null;
    const scheduleActivityRefresh = (targetId: number) => {
      if (targetId !== selectedIdRef.current) return;
      if (activityRefreshTimer !== null) window.clearTimeout(activityRefreshTimer);
      activityRefreshTimer = window.setTimeout(() => {
        activityRefreshTimer = null;
        void apiFetch<UserActivity>(`/dashboard/users/${targetId}/activity`)
          .then((payload) => {
            if (!stopped && targetId === selectedIdRef.current) setActivity(payload);
          })
          .catch(() => undefined);
      }, 1_000);
    };
    const onPlayback = (event: MessageEvent<string>) => {
      try {
        const updated = JSON.parse(event.data) as DashboardUser;
        const previousItemId = playbackItemByUser.current.get(updated.id) ?? null;
        const nextItemId = updated.playback?.itemId ?? null;
        playbackItemByUser.current.set(updated.id, nextItemId);
        setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
        setActivity((current) =>
          current?.user.id === updated.id ? { ...current, user: updated } : current
        );
        if (previousItemId !== nextItemId) scheduleActivityRefresh(updated.id);
      } catch {
        // Ignore a malformed event and keep the stream alive.
      }
    };
    const connect = () => {
      if (stopped) return;
      source = new EventSource(`${API_URL}/dashboard/stream`, { withCredentials: true });
      source.onopen = () => {
        retryDelay = 2_000;
        reconnecting = false;
      };
      source.addEventListener("playback", onPlayback as EventListener);
      source.onerror = () => {
        if (reconnecting || stopped) return;
        reconnecting = true;
        source?.close();
        source = null;
        void apiFetch("/auth/refresh", { method: "POST" }, false)
          .catch(() => undefined)
          .finally(() => {
            if (stopped) return;
            const delay = retryDelay;
            retryDelay = Math.min(retryDelay * 2, 30_000);
            retryTimer = window.setTimeout(() => {
              retryTimer = null;
              reconnecting = false;
              connect();
            }, delay);
          });
      };
    };
    connect();
    return () => {
      stopped = true;
      reconnecting = false;
      source?.close();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (activityRefreshTimer !== null) window.clearTimeout(activityRefreshTimer);
    };
  }, []);

  const selected = users.find((user) => user.id === selectedId) ?? null;
  const selectedIndex = selected ? users.findIndex((user) => user.id === selected.id) : -1;
  const favorites = useMemo(() => users.filter((user) => user.isFavorite), [users]);

  function move(direction: -1 | 1) {
    if (users.length < 2 || selectedIndex < 0) return;
    const next = (selectedIndex + direction + users.length) % users.length;
    setSelectedId(users[next]?.id ?? null);
  }

  async function toggleFavorite(user: DashboardUser) {
    const favorite = !user.isFavorite;
    setUsers((current) =>
      current.map((entry) => (entry.id === user.id ? { ...entry, isFavorite: favorite } : entry))
    );
    try {
      await apiFetch(`/dashboard/users/${user.id}/favorite`, {
        method: "PUT",
        body: JSON.stringify({ favorite })
      });
    } catch {
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, isFavorite: !favorite } : entry))
      );
    }
  }

  return (
    <div
      className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9"
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(distance) > 70) move(distance > 0 ? -1 : 1);
        touchStart.current = null;
      }}
    >
      <div className="mb-7">
        <div>
          <p className="eyebrow">{t("dashboard.today")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-2 text-sm text-muted">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card grid min-h-72 place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet/20 border-t-violet" />
        </div>
      ) : users.length === 0 ? (
        <div className="card grid min-h-80 place-items-center p-8 text-center">
          <div>
            <Users className="mx-auto h-10 w-10 text-muted" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              {t("dashboard.emptyCircleTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              {t("dashboard.emptyCircleDescription")}
            </p>
          </div>
        </div>
      ) : (
        <>
          {users.length > 1 && (
            <div className="mb-7">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => move(-1)}
                  aria-label={t("dashboard.previousUser")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{t("dashboard.displayedPerson")}</span>
                  <select
                    className="input"
                    value={selectedId ?? ""}
                    onChange={(event) => setSelectedId(Number(event.target.value))}
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => move(1)}
                  aria-label={t("dashboard.nextUser")}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {favorites.length > 0 && (
                <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                  {favorites.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={`flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                        selectedId === user.id
                          ? "border-violet/40 bg-violet/10"
                          : "border-white/[.07] bg-white/[.03] hover:bg-white/[.06]"
                      }`}
                    >
                      <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                      <span>
                        <span className="block text-sm font-medium text-white">{user.name}</span>
                        <span className="block text-xs text-muted">
                          {user.playback?.isPlaying
                            ? t("dashboard.live")
                            : t("dashboard.offline")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected && (
            <>
              <div className="mb-5 flex items-center gap-4">
                <Avatar name={selected.name} src={selected.avatarUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{t("dashboard.activityOf")}</p>
                  <h2 className="truncate text-2xl font-semibold text-white">{selected.name}</h2>
                </div>
                {users.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void toggleFavorite(selected)}
                    className={`icon-button ${selected.isFavorite ? "text-coral" : ""}`}
                    aria-label={
                      selected.isFavorite
                        ? t("dashboard.removeFavorite")
                        : t("dashboard.addFavorite")
                    }
                  >
                    <Heart className="h-5 w-5" fill={selected.isFavorite ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
              <LiveCard user={activity?.user ?? selected} />

              {selected.shareMode === "NONE" ? (
                <div className="mt-8 rounded-3xl border border-white/[.07] bg-white/[.03] p-8 text-center">
                  <EyeOff className="mx-auto h-8 w-8 text-muted" />
                  <h3 className="mt-3 font-medium text-white">
                    {t("dashboard.privateTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {t("dashboard.privateDescription", { name: selected.name })}
                  </p>
                </div>
              ) : selected.shareMode === "ONLY_WATCHING" ? (
                <div className="mt-8 rounded-3xl border border-white/[.07] bg-white/[.03] p-8 text-center">
                  <Radio className="mx-auto h-8 w-8 text-muted" />
                  <h3 className="mt-3 font-medium text-white">
                    {t("dashboard.liveOnlyTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {t("dashboard.liveOnlyDescription", { name: selected.name })}
                  </p>
                </div>
              ) : (
                <>
                  <ActivityShelf
                    title={t("dashboard.nextUpTitle", { name: selected.name })}
                    items={activity?.nextUp ?? []}
                    empty={t("dashboard.nextUpEmpty")}
                    kind="nextUp"
                  />
                  <ActivityShelf
                    title={t("dashboard.resumeTitle")}
                    items={activity?.resume ?? []}
                    empty={t("dashboard.resumeEmpty")}
                    kind="resume"
                  />
                  <ActivityShelf
                    title={t("dashboard.historyTitle")}
                    items={activity?.history ?? []}
                    empty={t("dashboard.historyEmpty")}
                    kind="history"
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
