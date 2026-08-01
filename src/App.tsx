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
const ProviderDetailPage = lazy(() =>
  import("@/pages/ProviderDetailPage").then((m) => ({ default: m.ProviderDetailPage })),
);
const ChannelsPage = lazy(() =>
  import("@/pages/ChannelsPage").then((m) => ({ default: m.ChannelsPage })),
);
const ChannelDetailPage = lazy(() =>
  import("@/pages/ChannelDetailPage").then((m) => ({ default: m.ChannelDetailPage })),
);
const ModelsPage = lazy(() =>
  import("@/pages/ModelsPage").then((m) => ({ default: m.ModelsPage })),
);
const ModelDetailPage = lazy(() =>
  import("@/pages/ModelDetailPage").then((m) => ({ default: m.ModelDetailPage })),
);
const ModelCatalogPage = lazy(() =>
  import("@/pages/ModelCatalogPage").then((m) => ({
    default: m.ModelCatalogPage,
  })),
);
const ModelCatalogRedirect = lazy(() =>
  import("@/pages/ModelCatalogPage").then((m) => ({
    default: m.ModelCatalogRedirect,
  })),
);
const RoutesPage = lazy(() =>
  import("@/pages/RoutesPage").then((m) => ({ default: m.RoutesPage })),
);
const RouteDetailPage = lazy(() =>
  import("@/pages/RouteDetailPage").then((m) => ({ default: m.RouteDetailPage })),
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
const LedgerPage = lazy(() =>
  import("@/pages/LedgerPage").then((m) => ({ default: m.LedgerPage })),
);
const SystemPage = lazy(() =>
  import("@/pages/SystemPage").then((m) => ({ default: m.SystemPage })),
);
const LoggingPage = lazy(() =>
  import("@/pages/LoggingPage").then((m) => ({ default: m.LoggingPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const UserDetailPage = lazy(() =>
  import("@/pages/UserDetailPage").then((m) => ({ default: m.UserDetailPage })),
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
            <Route path="providers/:providerId" element={<ProviderDetailPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="channels/:channelId" element={<ChannelDetailPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="models/catalog" element={<ModelCatalogPage />} />
            <Route path="models/:modelId" element={<ModelDetailPage />} />
            <Route path="model-catalog" element={<ModelCatalogRedirect />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="routes/:routeId" element={<RouteDetailPage />} />
            <Route path="capability-keys" element={<CapabilityKeysPage />} />
            <Route path="capability" element={<CapabilityPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="logs" element={<LoggingPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
            <Route path="users/:userId/api-keys" element={<ApiKeysPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
