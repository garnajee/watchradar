import { RefreshCw, Save, ServerCog, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { useI18n } from "../context/I18nContext";
import { apiFetch } from "../lib/api";
import { localizedError } from "../lib/error-message";

type AdminUser = {
  id: number;
  jellyfinUserId: string;
  name: string;
  avatarUrl: string;
  isEnabled: boolean;
  isAdmin: boolean;
};

type VisibilityEntry = {
  viewerId: number;
  targetId: number;
  canView: boolean;
};

export function AdminPage() {
  const { t } = useI18n();
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [matrixUsers, setMatrixUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const noticeTimer = useRef<number | null>(null);

  const loadAll = useCallback(async () => {
    const [configPayload, usersPayload, visibilityPayload] = await Promise.all([
      apiFetch<{ jellyfinUrl: string; configured: boolean }>("/admin/config"),
      apiFetch<{ users: AdminUser[] }>("/admin/users"),
      apiFetch<{ users: Array<{ id: number; name: string }>; entries: VisibilityEntry[] }>(
        "/admin/visibility"
      )
    ]);
    setJellyfinUrl(configPayload.jellyfinUrl);
    setConfigured(configPayload.configured);
    setUsers(usersPayload.users);
    setMatrixUsers(visibilityPayload.users);
    setVisibility(
      Object.fromEntries(
        visibilityPayload.entries.map((entry) => [
          `${entry.viewerId}:${entry.targetId}`,
          entry.canView
        ])
      )
    );
  }, []);

  useEffect(() => {
    void loadAll().catch((caught) =>
      setError(localizedError(caught, t, "errors.loadFailed"))
    );
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, [loadAll, t]);

  const enabledCount = useMemo(() => users.filter((user) => user.isEnabled).length, [users]);

  function success(message: string) {
    setNotice(message);
    setError("");
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    setBusy("config");
    setError("");
    try {
      const payload = await apiFetch<{ syncedUsers: number }>("/admin/config", {
        method: "POST",
        body: JSON.stringify({ jellyfinUrl, apiKey })
      });
      setApiKey("");
      setConfigured(true);
      success(
        t(
          payload.syncedUsers === 1
            ? "admin.configSavedOne"
            : "admin.configSavedOther",
          { count: payload.syncedUsers }
        )
      );
      await loadAll();
    } catch (caught) {
      setError(localizedError(caught, t, "errors.saveFailed"));
    } finally {
      setBusy("");
    }
  }

  async function syncUsers() {
    setBusy("sync");
    try {
      const payload = await apiFetch<{ syncedUsers: number }>("/admin/sync", { method: "POST" });
      await loadAll();
      success(
        t(
          payload.syncedUsers === 1 ? "admin.syncedOne" : "admin.syncedOther",
          { count: payload.syncedUsers }
        )
      );
    } catch (caught) {
      setError(localizedError(caught, t, "errors.syncFailed"));
    } finally {
      setBusy("");
    }
  }

  async function toggleUser(user: AdminUser) {
    setBusy(`user-${user.id}`);
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(user.jellyfinUserId)}/toggle`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !user.isEnabled })
      });
      await loadAll();
    } catch (caught) {
      setError(localizedError(caught, t, "errors.updateFailed"));
    } finally {
      setBusy("");
    }
  }

  async function saveVisibility() {
    setBusy("visibility");
    try {
      const entries = matrixUsers.flatMap((viewer) =>
        matrixUsers.map((target) => ({
          viewerId: viewer.id,
          targetId: target.id,
          canView: viewer.id === target.id || Boolean(visibility[`${viewer.id}:${target.id}`])
        }))
      );
      await apiFetch("/admin/visibility", {
        method: "PUT",
        body: JSON.stringify({ entries })
      });
      success(t("admin.visibilitySaved"));
    } catch (caught) {
      setError(localizedError(caught, t, "errors.saveFailed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <p className="eyebrow">{t("admin.eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {t("admin.title")}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {t("admin.description")}
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      )}

      <section className="card mt-8 p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet/15 text-violet-200">
            <ServerCog className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-white">
              {t("admin.jellyfinConnection")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {configured ? t("admin.configured") : t("admin.incomplete")}
            </p>
          </div>
        </div>
        <form onSubmit={(event) => void saveConfig(event)} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              {t("admin.httpsUrl")}
            </span>
            <input
              className="input"
              type="url"
              value={jellyfinUrl}
              onChange={(event) => setJellyfinUrl(event.target.value)}
              placeholder="https://jellyfin.example.com"
              required
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              {configured ? t("admin.newApiKey") : t("admin.apiKey")}
            </span>
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="button-primary" disabled={busy === "config"}>
            <Save className="h-4 w-4" />
            {t("common.save")}
          </button>
        </form>
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/[.07] p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan/10 text-cyan">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-white">{t("admin.members")}</h2>
              <p className="mt-1 text-sm text-muted">
                {t("admin.enabledCount", {
                  enabled: enabledCount,
                  total: users.length
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void syncUsers()}
            disabled={!configured || busy === "sync"}
          >
            <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("admin.sync")}</span>
          </button>
        </div>
        <div className="divide-y divide-white/[.06]">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-5 py-4 sm:px-7">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {user.isAdmin
                    ? t("admin.jellyfinAdministrator")
                    : t("admin.jellyfinUser")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={user.isEnabled}
                aria-label={t(
                  user.isEnabled ? "admin.disableUser" : "admin.enableUser",
                  { name: user.name }
                )}
                disabled={busy === `user-${user.id}`}
                onClick={() => void toggleUser(user)}
                className={`relative h-7 w-12 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                  user.isEnabled ? "bg-violet" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    user.isEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/[.07] p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-white">
                {t("admin.visibilityTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t("admin.visibilityDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={() => void saveVisibility()}
            disabled={busy === "visibility" || matrixUsers.length === 0}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.save")}</span>
          </button>
        </div>
        {matrixUsers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {t("admin.enableMember")}
          </p>
        ) : (
          <div className="overflow-x-auto p-4 sm:p-6">
            <table className="w-full min-w-[560px] border-separate border-spacing-2 text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {t("admin.sees")}
                  </th>
                  {matrixUsers.map((target) => (
                    <th key={target.id} className="max-w-28 p-2 text-center font-medium text-white">
                      <span className="block truncate">{target.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixUsers.map((viewer) => (
                  <tr key={viewer.id}>
                    <th className="max-w-36 p-2 text-left font-medium text-white">
                      <span className="block truncate">{viewer.name}</span>
                    </th>
                    {matrixUsers.map((target) => {
                      const key = `${viewer.id}:${target.id}`;
                      const self = viewer.id === target.id;
                      return (
                        <td key={target.id} className="p-1 text-center">
                          <label className="inline-grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-white/[.035] hover:bg-white/[.07]">
                            <input
                              type="checkbox"
                              className="h-5 w-5 accent-violet"
                              checked={self || Boolean(visibility[key])}
                              disabled={self}
                              onChange={(event) =>
                                setVisibility((current) => ({
                                  ...current,
                                  [key]: event.target.checked
                                }))
                              }
                              aria-label={t("admin.visibilityLabel", {
                                viewer: viewer.name,
                                target: target.name
                              })}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
