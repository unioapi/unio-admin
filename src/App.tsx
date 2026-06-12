import { LoginPage } from "@/pages/LoginPage";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { UsagePage } from "@/pages/UsagePage";
import { LedgerPage } from "@/pages/LedgerPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ApiKeysPage } from "@/pages/ApiKeysPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/api-keys" element={<ApiKeysPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
