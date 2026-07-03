import { Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAdapterProfiles,
  materializeAdapterSeed,
} from "@/lib/api/capability";
import { listAllModels, type Model } from "@/lib/api/models";
import { apiErrorMessage } from "@/lib/api/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportLevelBadge } from "@/components/capability/shared";
import { CapabilityDictionaryTab } from "@/components/capability/CapabilityDictionaryTab";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { formatLimits } from "@/lib/capability/limits";

type CapabilityPageTab = "dictionary" | "adapter";

export function CapabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  if (tabParam === "sync") {
    return <Navigate to="/models/catalog" replace />;
  }

  const pageTab: CapabilityPageTab =
    tabParam === "adapter" ? "adapter" : "dictionary";

  function setPageTab(next: CapabilityPageTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "dictionary") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={pageTab}
        onValueChange={(v) => setPageTab(v as CapabilityPageTab)}
      >
        <TabsList>
          <TabsTrigger value="dictionary">能力字典</TabsTrigger>
          <TabsTrigger value="adapter">Adapter 画像</TabsTrigger>
        </TabsList>

        <TabsContent value="dictionary" className="pt-4">
          <CapabilityDictionaryTab />
        </TabsContent>

        <TabsContent value="adapter" className="pt-4">
          <AdapterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdapterTab() {
  const [modelId, setModelId] = useState<string>("");
  const [pendingProfileKey, setPendingProfileKey] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["adapter-profiles"],
    queryFn: listAdapterProfiles,
  });

  const modelsQuery = useQuery({
    queryKey: ["all-models-enabled"],
    queryFn: () => listAllModels("enabled"),
  });

  const mutation = useMutation({
    mutationFn: (profileKey: string) =>
      materializeAdapterSeed(Number(modelId), profileKey),
    onSuccess: (res) => {
      toast.success(`已物化 ${res.materialized} 条能力到模型 #${res.model_id}`);
      setPendingProfileKey(null);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const models: Model[] = modelsQuery.data ?? [];
  const canMaterialize = modelId !== "" && !mutation.isPending;
  const selectedModel = models.find((m) => String(m.id) === modelId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label className="text-muted-foreground mb-1 block text-xs">
            物化目标模型
          </label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.display_name}（{m.model_id}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">
          物化会以 adapter_seed 幂等覆盖目标模型同 key 的既有声明。
        </p>
      </div>

      {profilesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{profilesQuery.error.message}</AlertDescription>
        </Alert>
      ) : profilesQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (profilesQuery.data ?? []).length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          没有可用的 adapter 画像
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(profilesQuery.data ?? []).map((profile) => (
            <div key={profile.key} className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-medium">
                    {profile.key}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {profile.declarations.length} 条能力声明
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!canMaterialize}
                  onClick={() => setPendingProfileKey(profile.key)}
                >
                  {mutation.isPending && <Spinner data-icon="inline-start" />}
                  物化到所选模型
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.declarations.map((d) => (
                  <span
                    key={d.capability_key}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
                  >
                    <span className="font-mono">{d.capability_key}</span>
                    <SupportLevelBadge level={d.support_level} />
                    {d.limits != null && (
                      <span className="text-muted-foreground font-mono">
                        {formatLimits(d.limits)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmActionDialog
        open={pendingProfileKey != null}
        onOpenChange={(o) => {
          if (!o && !mutation.isPending) setPendingProfileKey(null);
        }}
        title="物化能力声明"
        description={
          pendingProfileKey && selectedModel
            ? `确认将 adapter 画像「${pendingProfileKey}」物化到「${selectedModel.display_name}」？将覆盖目标模型中同 key 的既有能力声明。`
            : undefined
        }
        confirmLabel="确认物化"
        destructive
        pending={mutation.isPending}
        onConfirm={() => {
          if (pendingProfileKey) mutation.mutate(pendingProfileKey);
        }}
      />
    </div>
  );
}
