import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import {
  getApiKeysOpsSummary,
  getApiKeysOpsTable,
  type ApiKeyOpsRow,
} from "@/lib/api/customerOps";
import { getUser } from "@/lib/api/users";
import { deleteApiKey, revokeApiKey, updateApiKey } from "@/lib/api/apiKeys";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useServerList } from "@/hooks/useServerList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RangeFilter } from "@/components/common/RangeFilter";
import { MetricCard, MetricGrid } from "@/components/common/MetricCard";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { ServerDataTable } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  apiKeyOsColumns,
  API_KEY_OS_COLUMN_LABELS,
} from "@/components/openstatus-table/api-keys-os-columns";
import { CreateApiKeyDialog } from "@/components/customer/CreateApiKeyDialog";
import { formatInt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

type PendingKeyAction =
  | { type: "toggle"; key: ApiKeyOpsRow }
  | { type: "revoke"; key: ApiKeyOpsRow }
  | { type: "delete"; key: ApiKeyOpsRow };

export function ApiKeysPage() {
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);
  const validUser = Number.isFinite(userId) && userId > 0;
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const queryClient = useQueryClient();

  const { page, setPage, sorting, setSorting, sort } = useServerList({
    pageSize: PAGE_SIZE,
    defaultSort: { id: "requests", desc: true },
  });
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [pendingAction, setPendingAction] = useState<PendingKeyAction | null>(null);

  const user = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    enabled: validUser,
  });

  const summary = useQuery({
    queryKey: ["api-keys", userId, "ops-summary"],
    queryFn: () => getApiKeysOpsSummary(userId),
    refetchInterval: 60_000,
    enabled: validUser,
  });

  const query = useQuery({
    queryKey: ["api-keys", userId, "ops-table", { ...params, range: value.preset, page, sort, search }],
    queryFn: () =>
      getApiKeysOpsTable(userId, {
        ...params,
        range: value.preset,
        page,
        page_size: PAGE_SIZE,
        sort,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
    enabled: validUser,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });

  const toggle = useMutation({
    mutationFn: (k: ApiKeyOpsRow) => updateApiKey({ id: k.id, disabled: k.status !== "disabled" ? true : false }),
    onSuccess: () => { toast.success("已更新 Key"); refetch(); setPendingAction(null); },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => revokeApiKey(id),
    onSuccess: () => { toast.success("已吊销 Key"); refetch(); setPendingAction(null); },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteApiKey(id),
    onSuccess: () => { toast.success("已删除 Key"); refetch(); setPendingAction(null); },
    onError: (err) =>
      toast.error(
        apiErrorStatus(err) === 409
          ? "该 Key 已有调用记录，无法删除；请改用吊销"
          : apiErrorMessage(err),
      ),
  });

  const mutating = toggle.isPending || revoke.isPending || del.isPending;

  function confirmPending() {
    if (!pendingAction) return;
    if (pendingAction.type === "toggle") toggle.mutate(pendingAction.key);
    else if (pendingAction.type === "revoke") revoke.mutate(pendingAction.key.id);
    else del.mutate(pendingAction.key.id);
  }

  const columns = useMemo(
    () =>
      apiKeyOsColumns({
        onToggle: (k) => setPendingAction({ type: "toggle", key: k }),
        onRevoke: (k) => setPendingAction({ type: "revoke", key: k }),
        onDelete: (k) => setPendingAction({ type: "delete", key: k }),
      }),
    [],
  );

  const chips: FilterChip[] = [];
  if (search) {
    chips.push({
      id: "search",
      label: `搜索 · ${search}`,
      onRemove: () => {
        setSearchInput("");
        setPage(1);
      },
    });
  }

  const disabling = pendingAction?.type === "toggle" && pendingAction.key.status !== "disabled";
  const s = summary.data;

  if (!validUser) {
    return <Navigate to="/users" replace />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
            <Link to={`/users/${userId}`}><ChevronLeftIcon data-icon="inline-start" />返回用户</Link>
          </Button>
          <h2 className="font-heading text-lg font-semibold tracking-tight">API Key</h2>
          {user.isPending ? (
            <Skeleton className="mt-1 h-4 w-48" />
          ) : (
            <p className="text-muted-foreground text-sm">
              {user.data?.email ?? "—"} · 真实调用入口：线路、限额与用量
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter
            value={value}
            onChange={(v) => {
              setRange(v);
              setPage(1);
            }}
            refreshedAt={refreshedAt}
            onRefresh={refresh}
          />
          <CreateApiKeyDialog userId={userId}>
            <Button size="sm"><PlusIcon data-icon="inline-start" />新建 Key</Button>
          </CreateApiKeyDialog>
        </div>
      </div>

      <MetricGrid className="lg:grid-cols-3">
        <MetricCard label="Key 总数" loading={summary.isPending} value={formatInt(s?.key_total ?? 0)} />
        <MetricCard label="启用 Key" loading={summary.isPending} value={formatInt(s?.key_enabled ?? 0)} />
        <MetricCard label="已达上限" loading={summary.isPending} value={formatInt(s?.spend_capped ?? 0)} intent={s && s.spend_capped > 0 ? "warning" : "default"} />
      </MetricGrid>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey={`api-keys:${userId}:ops-table`}
          columns={columns}
          data={items}
          columnLabels={API_KEY_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyMessage="暂无 API Key"
          searchValue={searchInput}
          onSearchChange={(v) => {
            setSearchInput(v);
            setPage(1);
          }}
          searchPlaceholder="搜索 Key 名称 / 前缀"
          chips={chips}
          onClearChips={() => {
            setSearchInput("");
            setPage(1);
          }}
        />
      )}

      <ConfirmActionDialog
        open={pendingAction != null}
        onOpenChange={(o) => { if (!o && !mutating) setPendingAction(null); }}
        title={
          pendingAction?.type === "delete"
            ? "删除 API Key"
            : pendingAction?.type === "revoke"
              ? "吊销 API Key"
              : disabling
                ? "停用 API Key"
                : "启用 API Key"
        }
        description={
          pendingAction
            ? pendingAction.type === "delete"
              ? `确认删除「${pendingAction.key.name}」？仅未产生调用记录的 Key 可物理删除，删除不可恢复；若该 Key 已有调用记录，请改用「吊销」。`
              : pendingAction.type === "revoke"
                ? `确认吊销「${pendingAction.key.name}」？吊销不可恢复，该 Key 将立即失效，使用它的调用会全部失败。`
                : disabling
                  ? `确认停用「${pendingAction.key.name}」？停用后该 Key 暂停服务，可随时重新启用。`
                  : `确认启用「${pendingAction.key.name}」？启用后该 Key 恢复正常调用。`
            : undefined
        }
        confirmLabel={
          pendingAction?.type === "delete"
            ? "确认删除"
            : pendingAction?.type === "revoke"
              ? "确认吊销"
              : disabling
                ? "确认停用"
                : "确认启用"
        }
        destructive={
          pendingAction?.type === "delete" || pendingAction?.type === "revoke" || disabling
        }
        pending={mutating}
        onConfirm={confirmPending}
      />
    </div>
  );
}
