import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSystemConfig } from "@/lib/api/system";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RuntimeSettingsPanel } from "@/components/system/RuntimeSettingsPanel";

// 系统设置页只留「配置」职责：运行时配置(可编辑) + 网关配置(只读 env)。
// 任务记录已按领域归位：结算补偿 → 账本页「结算补偿」Tab;模型目录同步 → 参考目录页「同步记录」Tab。

const SYSTEM_TABS = ["providers", "config"] as const;
type SystemTab = (typeof SYSTEM_TABS)[number];

// 旧深链兼容(看板结算卡片等曾指向 /system?tab=jobs / recovery / sync)。
const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  recovery: "/ledger?tab=recovery",
  jobs: "/ledger?tab=recovery",
  sync: "/models/catalog?tab=jobs",
};

export function SystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");

  const legacyTarget = raw ? LEGACY_TAB_REDIRECTS[raw] : undefined;
  if (legacyTarget) {
    return <Navigate to={legacyTarget} replace />;
  }

  const tab: SystemTab = SYSTEM_TABS.includes(raw as SystemTab)
    ? (raw as SystemTab)
    : "providers";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === "providers") sp.delete("tab");
        else sp.set("tab", v);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="providers">运行时配置</TabsTrigger>
          <TabsTrigger value="config">网关配置(只读)</TabsTrigger>
        </TabsList>
        {/* 运行时配置：按域分 Tab(网关/运营判定/前端展示/Provider 策略),均免重启生效。 */}
        <TabsContent value="providers" className="pt-4">
          <RuntimeSettingsPanel />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigTab() {
  const query = useQuery({
    queryKey: ["system-config"],
    queryFn: getSystemConfig,
  });

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const config = query.data;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>只读配置</AlertTitle>
        <AlertDescription>{config.note}</AlertDescription>
      </Alert>
      <div className="grid gap-4 md:grid-cols-2">
        {config.groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-sm">{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {group.entries.map((entry) => (
                  <div key={entry.env} className="flex flex-col">
                    <dt className="text-muted-foreground text-xs">{entry.label}</dt>
                    <dd className="font-medium tabular-nums break-all">{entry.value}</dd>
                    <dd className="text-muted-foreground/70 font-mono text-[10px] break-all">
                      {entry.env}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
