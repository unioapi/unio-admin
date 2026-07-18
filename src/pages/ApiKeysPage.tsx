import { useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { getApiKeysOpsSummary, getApiKeysOpsTable, type ApiKeyOpsRow } from "@/lib/api/customerOps";
import { getUser } from "@/lib/api/users";
import { deleteApiKey, revokeApiKey, updateApiKey } from "@/lib/api/apiKeys";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useServerTable } from "@/hooks/useServerTable";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import {
  ApiKeysOverviewStats,
  ApiKeysOverviewStatsSkeleton,
} from "@/components/customer/ApiKeysOverviewStats";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  apiKeyOsColumns,
  API_KEY_OS_COLUMN_LABELS,
} from "@/components/openstatus-table/api-keys-os-columns";
import { ApiKeyFormDialog } from "@/components/customer/ApiKeyFormDialog";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type PendingKeyAction =
  | { type: "toggle"; key: ApiKeyOpsRow }
  | { type: "revoke"; key: ApiKeyOpsRow }
  | { type: "delete"; key: ApiKeyOpsRow };

export function ApiKeysPage() {
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);
  const validUser = Number.isFinite(userId) && userId > 0;
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const queryClient = useQueryClient();
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

  const table = useServerTable({
    queryKey: "api-keys",
    extraKey: [userId, rangeQuery],
    enabled: validUser,
    defaultSort: { id: "requests", desc: true },
    fetch: (p) => getApiKeysOpsTable(userId, { ...rangeQuery, ...p }),
  });

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

  const disabling = pendingAction?.type === "toggle" && pendingAction.key.status !== "disabled";
  const userEntity = user.data ?? null;
  const entityLoading = user.isPending;
  const notFound = user.isSuccess && userEntity == null;

  const overviewSummary =
    summary.isPending && !summary.data ? (
      <ApiKeysOverviewStatsSkeleton />
    ) : summary.data ? (
      <ApiKeysOverviewStats summary={summary.data} />
    ) : null;

  if (!validUser) {
    return <Navigate to="/users" replace />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/users", label: "返回用户列表" }}
        title="API Key"
        titleLoading={entityLoading}
        subtitle={
          userEntity ? (
            <>
              {userEntity.email} · {userEntity.display_name || "—"} · ID {userEntity.id}
              {userEntity.created_at ? ` · 注册 ${formatDateTime(userEntity.created_at)}` : ""}
            </>
          ) : null
        }
        actions={
          <>
            <RangeFilter
              value={value}
              onChange={(v) => {
                setRange(v);
                table.setPage(1);
              }}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
            <ApiKeyFormDialog userId={userId}>
              <Button size="sm">
                <PlusIcon data-icon="inline-start" />
                新建 Key
              </Button>
            </ApiKeyFormDialog>
          </>
        }
        summary={userEntity ? overviewSummary : null}
      />

      {user.isError || table.query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{((user.error ?? table.query.error) as Error).message}</AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>用户不存在</AlertTitle>
          <AlertDescription>
            <Link to="/users" className="underline underline-offset-4">
              返回用户列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey={`api-keys:${userId}:ops-table`}
          columns={columns}
          data={table.items}
          columnLabels={API_KEY_OS_COLUMN_LABELS}
          total={table.total}
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          getRowId={(r) => String(r.id)}
          loading={table.query.isPending}
          refetching={table.query.isFetching && !table.query.isPending}
          emptyMessage="暂无 API Key"
          searchValue={table.searchInput}
          onSearchChange={table.onSearchChange}
          searchPlaceholder="搜索 Key 名称 / 前缀"
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
