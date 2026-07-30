import { AlertTriangle, Eye, EyeOff, LockKeyhole, Radar } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useRouter } from "../context/RouterContext";
import { apiFetch } from "../lib/api";
import { localizedError } from "../lib/error-message";
import {
  getConfigurationWarningKey,
  type ConfigurationStatus
} from "../lib/setup-status";

export function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const { navigate } = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [configuration, setConfiguration] = useState<ConfigurationStatus | null>(null);
  const [configurationError, setConfigurationError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate("/", true);
  }, [navigate, user]);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<ConfigurationStatus>("/auth/status", { signal: controller.signal }, false)
      .then((payload) => {
        if (!controller.signal.aborted) setConfiguration(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigurationError(true);
      });
    return () => controller.abort();
  }, []);

  if (user) return null;
  const configurationWarningKey = getConfigurationWarningKey(
    configuration,
    configurationError
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (caught) {
      setError(localizedError(caught, t, "errors.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-night px-5 py-12 text-ink">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-violet/15 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet to-cyan shadow-glow">
            <Radar className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {t("common.productName")}
          </h1>
          <p className="mt-2 text-sm text-muted">{t("auth.tagline")}</p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="rounded-[2rem] border border-white/[.08] bg-panel/80 p-6 shadow-card backdrop-blur-xl sm:p-8"
        >
          <div className="mb-6">
            <p className="text-lg font-semibold text-white">{t("auth.title")}</p>
            <p className="mt-1 text-sm text-muted">{t("auth.subtitle")}</p>
          </div>

          {configurationWarningKey && (
            <div
              className="mb-5 flex gap-3 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3.5 text-sm text-red-100"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
              <div>
                <p className="font-semibold">{t("auth.configurationHeading")}</p>
                <p className="mt-1 leading-relaxed text-red-100/80">
                  {t(configurationWarningKey)}
                </p>
              </div>
            </div>
          )}

          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              {t("auth.username")}
            </span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              {t("auth.password")}
            </span>
            <span className="relative block">
              <input
                className="input pr-12"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 px-4 text-muted hover:text-white"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error && (
            <div
              className="mb-4 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-red-100"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="button-primary w-full"
            type="submit"
            disabled={busy || configuration?.jellyfinUrlConfigured === false}
          >
            <LockKeyhole className="h-4 w-4" />
            {busy ? t("auth.connecting") : t("auth.submit")}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-muted">
          {t("auth.passwordPrivacy")}
        </p>
      </div>
    </main>
  );
}
