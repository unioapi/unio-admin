import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import {
  getApiKeysOpsSummary,
  getApiKeysOpsTable,
  type ApiKeyOpsRow,
} from "@/lib/api/customerOps";
import { revokeApiKey, updateApiKey } from "@/lib/api/apiKeys";
import { apiErrorMessage } from "@/lib/api/client";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { MetricCard, MetricGrid } from "@/components/common/MetricCard";
import { ConfigurableDataTable } from "@/components/data-table";
import { apiKeyOpsColumns } from "@/components/ops-tables/api-keys-columns";
import { CreateApiKeyDialog } from "@/components/customer/CreateApiKeyDialog";
import { formatInt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ApiKeysPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const queryClient = useQueryClient();
  const rangeQuery = { ...params, range: value.preset };

  const summary = useQuery({
    queryKey: ["api-keys", projectId, "ops-summary"],
    queryFn: () => getApiKeysOpsSummary(projectId),
    refetchInterval: 60_000,
  });
  const table = useQuery({
    queryKey: ["api-keys", projectId, "ops-table", rangeQuery],
    queryFn: () => getApiKeysOpsTable(projectId, rangeQuery),
    placeholderData: keepPreviousData,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });

  const toggle = useMutation({
    mutationFn: (k: ApiKeyOpsRow) => updateApiKey({ id: k.id, disabled: k.status !== "disabled" ? true : false }),
    onSuccess: () => { toast.success("已更新 Key"); refetch(); },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => revokeApiKey(id),
    onSuccess: () => { toast.success("已吊销 Key"); refetch(); },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const s = summary.data;
  const columns = useMemo(
    () =>
      apiKeyOpsColumns({
        onToggle: (k) => toggle.mutate(k),
        onRevoke: (id) => revoke.mutate(id),
      }),
    [toggle.mutate, revoke.mutate],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
            <Link to="/projects"><ChevronLeftIcon data-icon="inline-start" />返回项目</Link>
          </Button>
          <h2 className="font-heading text-lg font-semibold tracking-tight">API Key</h2>
          <p className="text-muted-foreground text-sm">真实调用入口：线路、限额与用量</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter value={value} onChange={setRange} refreshedAt={refreshedAt} onRefresh={refresh} />
          <CreateApiKeyDialog projectId={projectId}>
            <Button size="sm"><PlusIcon data-icon="inline-start" />新建 Key</Button>
          </CreateApiKeyDialog>
        </div>
      </div>

      <MetricGrid className="lg:grid-cols-3">
        <MetricCard label="Key 总数" loading={summary.isPending} value={formatInt(s?.key_total ?? 0)} />
        <MetricCard label="启用 Key" loading={summary.isPending} value={formatInt(s?.key_enabled ?? 0)} />
        <MetricCard label="已达上限" loading={summary.isPending} value={formatInt(s?.spend_capped ?? 0)} intent={s && s.spend_capped > 0 ? "warning" : "default"} />
      </MetricGrid>

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <ConfigurableDataTable
          storageKey={`api-keys:${projectId}:ops-table`}
          data={table.data ?? []}
          columns={columns}
          loading={table.isPending}
          pinnedColumnId="name"
          emptyMessage="暂无 API Key"
          getRowId={(r) => String(r.id)}
          tableClassName={table.isFetching && !table.isPending ? "opacity-60" : undefined}
        />
      )}
    </div>
  );
}
