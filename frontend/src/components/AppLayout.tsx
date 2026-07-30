import { Gauge, LogOut, Radar, Settings, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { Link, useRouter } from "../context/RouterContext";
import { Avatar } from "./Avatar";

const linkClass = (isActive: boolean) =>
  `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
    isActive
      ? "bg-violet/15 text-white ring-1 ring-violet/25"
      : "text-muted hover:bg-white/5 hover:text-white"
  }`;

function NavItem({
  to,
  exact = false,
  children
}: {
  to: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const { path } = useRouter();
  const active = exact ? path === to : path.startsWith(to);
  return (
    <Link to={to} className={linkClass(active)}>
      {children}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-night text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-violet/10 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[.07] bg-night/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet to-cyan shadow-glow">
            <Radar className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="font-semibold tracking-tight text-white">
              {t("common.productName")}
            </p>
            <p className="text-[11px] uppercase tracking-[.24em] text-muted">
              {t("common.jellyfinCircle")}
            </p>
          </div>
        </div>
        <nav className="mt-10 space-y-2" aria-label={t("navigation.primaryLabel")}>
          <NavItem to="/" exact>
            <Gauge className="h-5 w-5" />
            {t("navigation.activity")}
          </NavItem>
          <NavItem to="/settings">
            <Settings className="h-5 w-5" />
            {t("navigation.sharing")}
          </NavItem>
          {user.isAdmin && (
            <NavItem to="/admin">
              <ShieldCheck className="h-5 w-5" />
              {t("navigation.administration")}
            </NavItem>
          )}
        </nav>
        <div className="mt-auto rounded-3xl border border-white/[.07] bg-white/[.03] p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-muted">
                {user.isAdmin
                  ? t("navigation.administrator")
                  : t("navigation.member")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-xl p-2 text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              aria-label={t("navigation.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/[.07] bg-night/80 px-4 backdrop-blur-xl lg:left-64 lg:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-cyan">
            <Radar className="h-5 w-5 text-white" />
          </span>
          <span className="font-semibold">{t("common.productName")}</span>
        </div>
        <p className="hidden text-xs uppercase tracking-[.2em] text-muted lg:block">
          {t("navigation.tagline")}
        </p>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:block">{user.name}</span>
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet lg:hidden"
            aria-label={t("navigation.logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative pb-28 pt-16 lg:ml-64 lg:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 rounded-3xl border border-white/10 bg-panel/90 p-2 shadow-card backdrop-blur-xl lg:hidden"
        aria-label={t("navigation.mobileLabel")}
      >
        <NavItem to="/" exact>
          <Gauge className="h-5 w-5" />
          <span className="hidden min-[390px]:inline">{t("navigation.activity")}</span>
        </NavItem>
        <NavItem to="/settings">
          <Settings className="h-5 w-5" />
          <span className="hidden min-[390px]:inline">
            {t("navigation.sharingShort")}
          </span>
        </NavItem>
        {user.isAdmin ? (
          <NavItem to="/admin">
            <ShieldCheck className="h-5 w-5" />
            <span className="hidden min-[390px]:inline">
              {t("navigation.adminShort")}
            </span>
          </NavItem>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
