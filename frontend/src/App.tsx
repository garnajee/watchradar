import { lazy, Suspense } from "react";
import { AppLayout } from "./components/AppLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import { useRouter } from "./context/RouterContext";
import { LoginPage } from "./pages/LoginPage";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({ default: module.AdminPage }))
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);

export default function App() {
  const { user, loading } = useAuth();
  const { path } = useRouter();
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  let page;
  if (path === "/" || path === "/login") page = <DashboardPage />;
  else if (path === "/settings") page = <SettingsPage />;
  else if (path === "/admin") page = user.isAdmin ? <AdminPage /> : <DashboardPage />;
  else page = <NotFoundPage />;

  return (
    <AppLayout>
      <Suspense fallback={<LoadingScreen />}>{page}</Suspense>
    </AppLayout>
  );
}
