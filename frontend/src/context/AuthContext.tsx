import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { apiFetch } from "../lib/api";
import type { CurrentUser, Locale } from "../types";
import { useI18n } from "./I18nContext";

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string, jellyfinUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  updateLocale: (locale: Locale) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const payload = await apiFetch<{ user: CurrentUser }>("/auth/me");
      setUser(payload.user);
      setLocale(payload.user.locale);
    } catch {
      setUser(null);
    }
  }, [setLocale]);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  const login = useCallback(
    async (username: string, password: string, jellyfinUrl?: string) => {
      const payload = await apiFetch<{ user: CurrentUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          ...(jellyfinUrl ? { jellyfinUrl } : {})
        })
      });
      setUser(payload.user);
      setLocale(payload.user.locale);
    },
    [setLocale]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const updateLocale = useCallback(
    async (locale: Locale) => {
      await apiFetch<{ locale: Locale }>("/user/locale", {
        method: "PUT",
        body: JSON.stringify({ locale })
      });
      setUser((current) => (current ? { ...current, locale } : current));
      setLocale(locale);
    },
    [setLocale]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, reload, updateLocale }),
    [user, loading, login, logout, reload, updateLocale]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
