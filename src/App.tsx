import { lazy, Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";

// 路由级代码分割：每个页面（含 recharts 等重依赖）拆为独立 chunk，
// 避免单一 entry chunk 体积过大（vite >500kB 警告）。
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ProvidersPage = lazy(() =>
  import("@/pages/ProvidersPage").then((m) => ({ default: m.ProvidersPage })),
);
const ChannelsPage = lazy(() =>
  import("@/pages/ChannelsPage").then((m) => ({ default: m.ChannelsPage })),
);
const ModelsPage = lazy(() =>
  import("@/pages/ModelsPage").then((m) => ({ default: m.ModelsPage })),
);
const ModelCatalogPage = lazy(() =>
  import("@/pages/ModelCatalogPage").then((m) => ({
    default: m.ModelCatalogPage,
  })),
);
const RoutesPage = lazy(() =>
  import("@/pages/RoutesPage").then((m) => ({ default: m.RoutesPage })),
);
const CapabilityPage = lazy(() =>
  import("@/pages/CapabilityPage").then((m) => ({ default: m.CapabilityPage })),
);
const CapabilityKeysPage = lazy(() =>
  import("@/pages/CapabilityKeysPage").then((m) => ({
    default: m.CapabilityKeysPage,
  })),
);
const RequestsPage = lazy(() =>
  import("@/pages/RequestsPage").then((m) => ({ default: m.RequestsPage })),
);
const UsagePage = lazy(() =>
  import("@/pages/UsagePage").then((m) => ({ default: m.UsagePage })),
);
const LedgerPage = lazy(() =>
  import("@/pages/LedgerPage").then((m) => ({ default: m.LedgerPage })),
);
const SystemPage = lazy(() =>
  import("@/pages/SystemPage").then((m) => ({ default: m.SystemPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })),
);
const ApiKeysPage = lazy(() =>
  import("@/pages/ApiKeysPage").then((m) => ({ default: m.ApiKeysPage })),
);

function PageFallback() {
  return (
    <div className="flex h-full min-h-64 w-full items-center justify-center py-16">
      <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<DashboardPage />} />
            <Route path="providers" element={<ProvidersPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="model-catalog" element={<ModelCatalogPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="capability-keys" element={<CapabilityKeysPage />} />
            <Route path="capability" element={<CapabilityPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route
              path="projects/:projectId/api-keys"
              element={<ApiKeysPage />}
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
