import { Check, Eye, EyeOff, Globe2, Languages, ListChecks, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "../components/MediaImage";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { apiFetch } from "../lib/api";
import { localizedError } from "../lib/error-message";
import type { TranslationKey } from "../lib/i18n";
import type { LibraryItem, Locale, ShareMode, SharedItem } from "../types";

export function SettingsPage() {
  const { user, updateLocale } = useAuth();
  const { locale, t } = useI18n();
  const [mode, setMode] = useState<ShareMode>("ONLY_WATCHING");
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [error, setError] = useState("");
  const noticeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    []
  );

  useEffect(() => {
    void apiFetch<{ shareMode: ShareMode; locale: Locale; sharedItems: SharedItem[] }>(
      "/user/preferences"
    )
      .then((payload) => {
        setMode(payload.shareMode);
        setSharedItems(payload.sharedItems);
      })
      .catch((caught) => setError(localizedError(caught, t, "errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (mode !== "SELECTED") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void apiFetch<{ items: LibraryItem[] }>(
        `/user/library?search=${encodeURIComponent(search)}`,
        { signal: controller.signal }
      )
        .then((payload) => {
          if (!controller.signal.aborted) setLibrary(payload.items);
        })
        .catch((caught) => {
          if (!controller.signal.aborted) {
            setError(localizedError(caught, t, "errors.catalogUnavailable"));
          }
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, search, t]);

  const modes = useMemo<
    Array<{
      value: ShareMode;
      title: string;
      description: string;
      icon: typeof Globe2;
    }>
  >(
    () => [
      {
        value: "ALL",
        title: t("settings.modes.all.title"),
        description: t("settings.modes.all.description"),
        icon: Globe2
      },
      {
        value: "ONLY_WATCHING",
        title: t("settings.modes.watching.title"),
        description: t("settings.modes.watching.description"),
        icon: Eye
      },
      {
        value: "SELECTED",
        title: t("settings.modes.selected.title"),
        description: t("settings.modes.selected.description"),
        icon: ListChecks
      },
      {
        value: "NONE",
        title: t("settings.modes.none.title"),
        description: t("settings.modes.none.description"),
        icon: EyeOff
      }
    ],
    [t]
  );

  const selectedIds = useMemo(
    () => new Set(sharedItems.map((item) => item.jellyfinItemId)),
    [sharedItems]
  );

  async function chooseMode(nextMode: ShareMode) {
    const previous = mode;
    setMode(nextMode);
    setError("");
    try {
      await apiFetch("/user/preferences", {
        method: "PUT",
        body: JSON.stringify({ shareMode: nextMode })
      });
      setNotice("settings.preferenceSaved");
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 2400);
    } catch (caught) {
      setMode(previous);
      setError(localizedError(caught, t, "errors.saveFailed"));
    }
  }

  async function chooseLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    setError("");
    try {
      await updateLocale(nextLocale);
      setNotice("settings.language.saved");
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 2400);
    } catch (caught) {
      setError(localizedError(caught, t, "errors.saveFailed"));
    }
  }

  async function toggleItem(item: LibraryItem) {
    const selected = !selectedIds.has(item.id);
    setBusyItem(item.id);
    setError("");
    try {
      await apiFetch("/user/shared-items", {
        method: "POST",
        body: JSON.stringify({
          jellyfinItemId: item.id,
          itemType: item.type,
          name: item.name,
          imageTag: item.imageTag ?? undefined,
          selected
        })
      });
      setSharedItems((current) =>
        selected
          ? [
              ...current,
              {
                id: Date.now(),
                jellyfinItemId: item.id,
                itemType: item.type,
                name: item.name,
                imageTag: item.imageTag
              }
            ]
          : current.filter((entry) => entry.jellyfinItemId !== item.id)
      );
    } catch (caught) {
      setError(localizedError(caught, t, "errors.updateFailed"));
    } finally {
      setBusyItem(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <p className="eyebrow">{t("settings.eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {t("settings.title")}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {t("settings.description")}
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <Check className="h-4 w-4" />
          {t(notice)}
        </div>
      )}

      <section className="card mt-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan">
            <Languages className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-white">
              {t("settings.language.title")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("settings.language.description")}
            </p>
          </div>
        </div>
        <label className="block sm:w-52">
          <span className="sr-only">{t("settings.language.label")}</span>
          <select
            className="input"
            value={user?.locale ?? locale}
            onChange={(event) => void chooseLocale(event.target.value as Locale)}
          >
            <option value="en">{t("settings.language.english")}</option>
            <option value="fr">{t("settings.language.french")}</option>
          </select>
        </label>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {t("settings.sharingTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((entry) => {
            const Icon = entry.icon;
            const active = mode === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                disabled={loading}
                onClick={() => void chooseMode(entry.value)}
                className={`flex gap-4 rounded-3xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                  active
                    ? "border-violet/50 bg-violet/10 shadow-glow"
                    : "border-white/[.07] bg-white/[.025] hover:border-white/15 hover:bg-white/[.045]"
                }`}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                    active ? "bg-violet text-white" : "bg-white/5 text-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="flex items-center gap-2 font-medium text-white">
                    {entry.title}
                    {active && <Check className="h-4 w-4 text-cyan" />}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {entry.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {mode === "SELECTED" && (
        <section className="mt-10">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t("settings.allowedTitles")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t(
                  sharedItems.length === 1
                    ? "common.counts.selectedOne"
                    : "common.counts.selectedOther",
                  { count: sharedItems.length }
                )}
              </p>
            </div>
            <label className="relative block sm:w-72">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input pl-11"
                placeholder={t("common.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {library.map((item) => {
              const selected = selectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busyItem === item.id}
                  onClick={() => void toggleItem(item)}
                  className={`group overflow-hidden rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                    selected
                      ? "border-violet/60 bg-violet/10"
                      : "border-white/[.07] bg-white/[.025] hover:border-white/20"
                  }`}
                >
                  <span className="relative block aspect-[2/3]">
                    <MediaImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full transition duration-500 group-hover:scale-105"
                    />
                    <span
                      className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border ${
                        selected
                          ? "border-violet bg-violet text-white"
                          : "border-white/30 bg-black/40 text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="block p-3">
                    <span className="block truncate text-sm font-medium text-white">{item.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {item.type === "Movie"
                        ? t("common.movie")
                        : t("common.series")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
