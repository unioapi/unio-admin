import { Navigate, useSearchParams } from "react-router-dom";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ModelCatalogTab } from "@/components/models/ModelCatalogTab";
import { CatalogSyncJobsPanel } from "@/components/models/CatalogSyncJobsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModelCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: "catalog" | "jobs" = searchParams.get("tab") === "jobs" ? "jobs" : "catalog";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === "jobs") sp.set("tab", "jobs");
        else sp.delete("tab");
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/models", label: "返回模型列表" }}
        title="参考模型"
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="catalog">参考目录</TabsTrigger>
          <TabsTrigger value="jobs">同步记录</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="pt-4">
          <ModelCatalogTab />
        </TabsContent>
        {/* models.dev 同步任务记录(原系统页迁入)：与目录页的同步触发入口同屏。 */}
        <TabsContent value="jobs" className="pt-4">
          <CatalogSyncJobsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 旧路由兼容：/model-catalog → /models/catalog */
export function ModelCatalogRedirect() {
  return <Navigate to="/models/catalog" replace />;
}
