import { useEffect, useMemo, useState } from "react";
import {
  getFilteredRowModel,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnDef,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  EllipsisIcon,
  HistoryIcon,
  Link2Icon,
  ListFilterIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  bindChannelModels,
  createChannelModelDiscovery,
  createChannelModelVerification,
  getChannelModelDiscovery,
  getChannelModelInventory,
  getChannelModelVerification,
  isTerminalRun,
  listChannelModelDiscoveries,
  type ChannelModelInventoryBinding,
  type ChannelModelInventoryItem,
  type InventoryCatalogCandidate,
  type InventoryModelCandidate,
} from "@/lib/api/channelModelInventory";
import { updateChannelModel } from "@/lib/api/channelModels";
import { listAllModels, type Model } from "@/lib/api/models";
import { getChannelOpsModels } from "@/lib/api/channelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { apiErrorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/format";
import { AdoptFromCatalogDialog } from "@/components/models/AdoptFromCatalogDialog";
import { ConfigurableDataTable } from "@/components/data-table";
import { DataTable } from "@/components/tablecn/data-table";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { DataTableToolbar } from "@/components/tablecn/data-table-toolbar";
import {
  CHANNEL_OPS_MODEL_COLUMN_LABELS,
  channelOpsModelColumns,
} from "@/components/detail-tables/channel-detail-columns";
import { ErrorBox, SectionEmpty, TableSkeleton } from "@/components/common/detail-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InventoryView = "inventory" | "performance" | "history";

export function ChannelModelInventorySection({
  channelId,
  range,
  setup,
}: {
  channelId: number;
  range: RangeQuery;
  setup: boolean;
}) {
  const queryClient = useQueryClient();
  const inventoryKey = useMemo(
    () => ["channel", channelId, "model-inventory"] as const,
    [channelId],
  );
  const [view, setView] = useState<InventoryView>("inventory");
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | null>(null);
  const [activeVerificationId, setActiveVerificationId] = useState<number | null>(null);
  const [verificationLabel, setVerificationLabel] = useState("");
  const [manualUpstream, setManualUpstream] = useState<string | null>(null);
  const [remapBinding, setRemapBinding] = useState<ChannelModelInventoryBinding | null>(null);

  const inventoryQuery = useQuery({
    queryKey: inventoryKey,
    queryFn: () => getChannelModelInventory(channelId),
    retry: false,
  });

  useEffect(() => {
    const latest = inventoryQuery.data?.latest_discovery;
    if (latest && !isTerminalRun(latest.status)) setActiveDiscoveryId(latest.id);
  }, [inventoryQuery.data?.latest_discovery]);

  const discoveryQuery = useQuery({
    queryKey: ["channel", channelId, "model-discovery", activeDiscoveryId],
    queryFn: () => getChannelModelDiscovery(channelId, activeDiscoveryId!),
    enabled: activeDiscoveryId != null,
    refetchInterval: (query) =>
      query.state.data && isTerminalRun(query.state.data.status) ? false : 1_000,
  });

  const verificationQuery = useQuery({
    queryKey: ["channel", channelId, "model-verification", activeVerificationId],
    queryFn: () => getChannelModelVerification(channelId, activeVerificationId!),
    enabled: activeVerificationId != null,
    refetchInterval: (query) =>
      query.state.data && isTerminalRun(query.state.data.run.status) ? false : 1_000,
  });

  useEffect(() => {
    const run = discoveryQuery.data;
    if (!run || !isTerminalRun(run.status)) return;
    setActiveDiscoveryId(null);
    void queryClient.invalidateQueries({ queryKey: inventoryKey });
    void queryClient.invalidateQueries({ queryKey: ["channel", channelId, "model-discoveries"] });
    if (run.status === "succeeded") toast.success(`发现完成，共 ${run.total_count} 个上游模型`);
    else if (run.status === "stale") toast.warning("渠道配置已变化，本次发现结果未替换成功快照");
    else toast.error(run.message ?? "模型发现失败，已保留上次成功快照");
  }, [channelId, discoveryQuery.data, inventoryKey, queryClient]);

  useEffect(() => {
    const result = verificationQuery.data;
    if (!result || !isTerminalRun(result.run.status)) return;
    setActiveVerificationId(null);
    void queryClient.invalidateQueries({ queryKey: inventoryKey });
    if (result.run.status === "succeeded") toast.success(`${verificationLabel || "模型"}验证通过`);
    else if (result.run.status === "stale") toast.warning("配置已变化，验证结果已过期，请重新验证");
    else toast.error(result.run.message ?? `${verificationLabel || "模型"}验证未通过`);
  }, [inventoryKey, queryClient, verificationLabel, verificationQuery.data]);

  const discoveryMutation = useMutation({
    mutationFn: () => createChannelModelDiscovery(channelId, setup ? "setup" : "manual"),
    onSuccess: (run) => setActiveDiscoveryId(run.id),
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const verificationMutation = useMutation({
    mutationFn: (target: { modelId: number; upstream: string; label: string }) =>
      createChannelModelVerification(
        channelId,
        [{ model_id: target.modelId, upstream_model: target.upstream }],
        setup ? "setup" : "manual",
      ),
    onSuccess: (result, target) => {
      setVerificationLabel(target.label);
      setActiveVerificationId(result.run.id);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const bindMutation = useMutation({
    mutationFn: ({ modelId, upstream }: { modelId: number; upstream: string }) =>
      bindChannelModels(channelId, [{ model_id: modelId, upstream_model: upstream }]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKey });
      toast.success("已创建停用绑定，请先验证再启用");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ binding, status }: { binding: ChannelModelInventoryBinding; status: string }) =>
      updateChannelModel({
        channelId,
        modelId: binding.model_id,
        upstream_model: binding.upstream_model,
        status,
        verification_item_id:
          status === "enabled" ? binding.verification?.item_id : undefined,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: inventoryKey });
      toast.success(variables.status === "enabled" ? "绑定已启用" : "绑定已停用");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (inventoryQuery.isPending) return <TableSkeleton rows={6} cols={7} />;
  if (inventoryQuery.isError) return <ErrorBox message={apiErrorMessage(inventoryQuery.error)} />;

  const inventory = inventoryQuery.data;
  const discoveryRunning = activeDiscoveryId != null || discoveryMutation.isPending;
  const verificationRunning = activeVerificationId != null || verificationMutation.isPending;
  const latestFailed = inventory.latest_discovery?.status === "failed";
  const hasSnapshot = inventory.snapshot != null;

  const inventoryItems = inventory.items;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {setup ? (
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>渠道已按停用状态创建</AlertTitle>
          <AlertDescription>
            先发现上游模型，再关联本地或参考模型；绑定验证成功后由管理员显式启用。
          </AlertDescription>
        </Alert>
      ) : null}

      {latestFailed ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>最近一次发现失败</AlertTitle>
          <AlertDescription>
            {inventory.latest_discovery?.message ?? "上游模型列表暂不可用。"}
            {hasSnapshot ? " 当前仍展示上次成功快照。" : " 可使用手工绑定继续配置。"}
          </AlertDescription>
        </Alert>
      ) : inventory.snapshot_stale ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>发现快照已过期</AlertTitle>
          <AlertDescription>渠道或 Provider 配置发生过变化，请重新发现后再据此处理模型。</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center text-sm">
          <span className="text-muted-foreground text-xs">
            {inventory.snapshot?.completed_at
              ? `成功快照 ${formatRelativeTime(inventory.snapshot.completed_at)}`
              : "尚无成功快照"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setManualUpstream("")}>
            <Link2Icon data-icon="inline-start" />
            手工绑定
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={discoveryRunning}
            onClick={() => discoveryMutation.mutate()}
          >
            {discoveryRunning ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
            {inventory.snapshot ? "重新发现" : "发现模型"}
          </Button>
        </div>
      </div>

      {(discoveryRunning || verificationRunning) && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {discoveryRunning ? "正在读取上游模型列表…" : `正在验证${verificationLabel ? `「${verificationLabel}」` : "模型"}…`}
        </div>
      )}

      <Tabs value={view} onValueChange={(value) => setView(value as InventoryView)} className="min-w-0 gap-4">
        <div className="overflow-x-auto">
          <TabsList aria-label="渠道模型视图" className="min-w-max">
            <TabsTrigger value="inventory">模型清单 {inventory.items.length}</TabsTrigger>
            <TabsTrigger value="performance">运行表现</TabsTrigger>
            <TabsTrigger value="history">发现历史</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inventory" className="min-w-0">
          {inventoryItems.length === 0 ? (
            <SectionEmpty
              icon={SearchIcon}
              title="暂无模型"
              description="运行上游发现或使用手工绑定添加模型"
            />
          ) : (
            <InventoryTable
              items={inventoryItems}
              busy={bindMutation.isPending || verificationRunning || statusMutation.isPending}
              onBind={(model, upstream) => bindMutation.mutate({ modelId: model.id, upstream })}
              onManualBind={setManualUpstream}
              onVerify={(binding) =>
                verificationMutation.mutate({
                  modelId: binding.model_id,
                  upstream: binding.upstream_model,
                  label: binding.model_external_id,
                })
              }
              onStatus={(binding, status) => statusMutation.mutate({ binding, status })}
              onRemap={setRemapBinding}
              onAdopted={() => void queryClient.invalidateQueries({ queryKey: inventoryKey })}
              channelId={channelId}
            />
          )}
        </TabsContent>

        <TabsContent value="performance">
          <ModelPerformance channelId={channelId} range={range} />
        </TabsContent>
        <TabsContent value="history">
          <DiscoveryHistory channelId={channelId} active={view === "history"} />
        </TabsContent>
      </Tabs>

      <ManualBindingDialog
        open={manualUpstream != null}
        onOpenChange={(open) => !open && setManualUpstream(null)}
        channelId={channelId}
        upstreamModel={manualUpstream ?? ""}
        onBound={() => void queryClient.invalidateQueries({ queryKey: inventoryKey })}
      />
      <VerifyAndRemapDialog
        open={remapBinding != null}
        onOpenChange={(open) => !open && setRemapBinding(null)}
        channelId={channelId}
        binding={remapBinding}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: inventoryKey })}
      />
    </div>
  );
}

function localModelLabel(item: ChannelModelInventoryItem): string {
  return item.bindings[0]?.model_display_name ?? item.match.exact_model?.display_name ?? "";
}

function referenceModelLabel(item: ChannelModelInventoryItem): string {
  if (item.match.kind === "bound") {
    return item.bindings.find((binding) => binding.adopted_canonical_id)?.adopted_canonical_id ?? "";
  }
  if (item.match.exact_model) return item.match.exact_model.display_name;
  return item.match.catalog_candidates[0]?.canonical_id ?? "";
}

function bindingStatusLabel(item: ChannelModelInventoryItem): string {
  return item.bindings.map((binding) => binding.status).join(",") || "unbound";
}

function verificationStatusLabel(item: ChannelModelInventoryItem): string {
  return item.bindings
    .map((binding) => {
      const verification = binding.verification;
      if (!verification) return "unverified";
      if (!verification.current) return "expired";
      return verification.status;
    })
    .join(",") || "unverified";
}

function isPendingItem(item: ChannelModelInventoryItem): boolean {
  if (item.discovery_state !== "discovered" || item.bindings.length === 0) return true;
  return item.bindings.some(
    (binding) =>
      binding.status === "disabled" ||
      !binding.verification?.current ||
      binding.verification.status !== "succeeded",
  );
}

function bindingSortRank(item: ChannelModelInventoryItem): number {
  if (item.bindings.length === 0) return 0;
  return item.bindings.some((binding) => binding.status !== "enabled") ? 1 : 2;
}

function discoverySortRank(item: ChannelModelInventoryItem): number {
  return item.discovery_state === "not_seen" ? 0 : 1;
}

const inventorySelectFilter: FilterFn<ChannelModelInventoryItem> = (
  row,
  columnId,
  filterValue,
) => {
  const selected = filterValue as string[] | undefined;
  return !selected?.length || selected.includes(String(row.getValue(columnId)));
};

const bindingStatusFilter: FilterFn<ChannelModelInventoryItem> = (
  row,
  _columnId,
  filterValue,
) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  if (row.original.bindings.length === 0) return selected.includes("unbound");
  return row.original.bindings.some((binding) => selected.includes(binding.status));
};

const verificationStatusFilter: FilterFn<ChannelModelInventoryItem> = (
  row,
  _columnId,
  filterValue,
) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  if (row.original.bindings.length === 0) return selected.includes("pending_binding");
  return row.original.bindings.some((binding) => {
    const verification = binding.verification;
    const state = !verification
      ? "unverified"
      : !verification.current
        ? "expired"
        : verification.status === "succeeded"
          ? "succeeded"
          : "failed";
    return selected.includes(state);
  });
};

function InventoryTable({
  items,
  busy,
  channelId,
  onBind,
  onManualBind,
  onVerify,
  onStatus,
  onRemap,
  onAdopted,
}: {
  items: ChannelModelInventoryItem[];
  busy: boolean;
  channelId: number;
  onBind: (model: InventoryModelCandidate, upstream: string) => void;
  onManualBind: (upstream: string) => void;
  onVerify: (binding: ChannelModelInventoryBinding) => void;
  onStatus: (binding: ChannelModelInventoryBinding, status: string) => void;
  onRemap: (binding: ChannelModelInventoryBinding) => void;
  onAdopted: () => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "binding_status", desc: false },
    { id: "discovery_state", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columns = useMemo<ColumnDef<ChannelModelInventoryItem, unknown>[]>(
    () => [
      {
        id: "attention",
        accessorFn: (item) => (isPendingItem(item) ? "pending" : "ready"),
        header: "处理状态",
        enableHiding: false,
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: inventorySelectFilter,
        meta: {
          label: "处理状态",
          variant: "select",
          options: [
            { label: "待处理", value: "pending" },
            { label: "已处理", value: "ready" },
          ],
        },
      },
      {
        id: "upstream_model",
        accessorKey: "upstream_model",
        header: ({ column }) => <DataTableColumnHeader column={column} label="上游模型 ID" />,
        size: 220,
        minSize: 160,
        enableHiding: false,
        enableColumnFilter: true,
        meta: {
          label: "上游模型",
          variant: "text",
          placeholder: "搜索上游模型",
        },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            <code className="break-all text-xs font-medium">{row.original.upstream_model}</code>
            {row.original.owned_by ? <span className="text-muted-foreground text-xs">{row.original.owned_by}</span> : null}
          </div>
        ),
      },
      {
        id: "binding_status",
        accessorFn: bindingStatusLabel,
        header: ({ column }) => <DataTableColumnHeader column={column} label="绑定状态" />,
        size: 112,
        sortingFn: (left, right) =>
          bindingSortRank(left.original) - bindingSortRank(right.original),
        enableColumnFilter: true,
        filterFn: bindingStatusFilter,
        meta: {
          label: "绑定状态",
          variant: "select",
          options: [
            { label: "未绑定", value: "unbound" },
            { label: "已停用", value: "disabled" },
            { label: "已启用", value: "enabled" },
          ],
        },
        cell: ({ row }) => <BindingStatus item={row.original} />,
      },
      {
        id: "discovery_state",
        accessorFn: (item) => item.discovery_state,
        header: ({ column }) => <DataTableColumnHeader column={column} label="上游状态" />,
        size: 112,
        sortingFn: (left, right) =>
          discoverySortRank(left.original) - discoverySortRank(right.original),
        enableColumnFilter: true,
        filterFn: inventorySelectFilter,
        meta: {
          label: "上游状态",
          variant: "select",
          options: [
            { label: "本次发现", value: "discovered" },
            { label: "本次未发现", value: "not_seen" },
          ],
        },
        cell: ({ row }) => (
          <Badge variant={row.original.discovery_state === "discovered" ? "secondary" : "outline"}>
            {row.original.discovery_state === "discovered" ? "本次发现" : "本次未发现"}
          </Badge>
        ),
      },
      {
        id: "local_model",
        accessorFn: localModelLabel,
        header: ({ column }) => <DataTableColumnHeader column={column} label="本地模型" />,
        size: 180,
        cell: ({ row }) => <BindingModels item={row.original} />,
      },
      {
        id: "reference_match",
        accessorFn: referenceModelLabel,
        header: ({ column }) => <DataTableColumnHeader column={column} label="参考目录" />,
        size: 180,
        enableSorting: false,
        cell: ({ row }) => <ReferenceMatch item={row.original} />,
      },
      {
        id: "verification_status",
        accessorFn: verificationStatusLabel,
        header: ({ column }) => <DataTableColumnHeader column={column} label="验证状态" />,
        size: 128,
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: verificationStatusFilter,
        meta: {
          label: "验证状态",
          variant: "select",
          options: [
            { label: "待绑定", value: "pending_binding" },
            { label: "未验证", value: "unverified" },
            { label: "已过期", value: "expired" },
            { label: "验证通过", value: "succeeded" },
            { label: "验证失败", value: "failed" },
          ],
        },
        cell: ({ row }) => <VerificationStatus item={row.original} />,
      },
      {
        id: "actions",
        header: () => <span className="text-muted-foreground">操作</span>,
        size: 56,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <InventoryActions
              item={row.original}
              busy={busy}
              channelId={channelId}
              onBind={onBind}
              onManualBind={onManualBind}
              onVerify={onVerify}
              onStatus={onStatus}
              onRemap={onRemap}
              onAdopted={onAdopted}
            />
          </div>
        ),
      },
    ],
    [busy, channelId, onAdopted, onBind, onManualBind, onRemap, onStatus, onVerify],
  );
  const table = useReactTable({
    data: items,
    columns,
    initialState: { columnVisibility: { attention: false } },
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (item) => item.upstream_model,
  });

  return (
    <DataTable
      table={table}
      hidePagination
      emptyMessage="没有匹配筛选条件的模型"
      className="min-w-0"
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

function BindingModels({ item }: { item: ChannelModelInventoryItem }) {
  if (item.bindings.length === 0) return <span className="text-muted-foreground text-sm">未绑定</span>;
  return (
    <div className="flex flex-col gap-2">
      {item.bindings.map((binding) => (
        <div key={binding.id} className="min-w-0">
          <div className="truncate text-sm font-medium">{binding.model_display_name}</div>
          <code className="text-muted-foreground break-all text-xs">{binding.model_external_id}</code>
          {binding.model_status !== "enabled" ? <Badge variant="outline" className="ml-1">模型停用</Badge> : null}
        </div>
      ))}
    </div>
  );
}

function ReferenceMatch({ item }: { item: ChannelModelInventoryItem }) {
  if (item.match.kind === "bound") {
    const canonical = item.bindings.find((binding) => binding.adopted_canonical_id)?.adopted_canonical_id;
    return canonical ? <code className="break-all text-xs">{canonical}</code> : <span className="text-muted-foreground text-sm">—</span>;
  }
  if (item.match.exact_model) return <span className="text-sm">本地精确匹配</span>;
  if (item.match.catalog_candidates.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {item.match.catalog_candidates.slice(0, 2).map((candidate) => (
          <code key={candidate.canonical_id} className="break-all text-xs">{candidate.canonical_id}</code>
        ))}
        {item.match.catalog_candidates.length > 2 ? (
          <span className="text-muted-foreground text-xs">另 {item.match.catalog_candidates.length - 2} 个候选</span>
        ) : null}
      </div>
    );
  }
  return <span className="text-muted-foreground text-sm">无匹配</span>;
}

function BindingStatus({ item }: { item: ChannelModelInventoryItem }) {
  if (item.bindings.length === 0) return <Badge variant="outline">未绑定</Badge>;
  return (
    <div className="flex flex-col items-start gap-1">
      {item.bindings.map((binding) => (
        <Badge key={binding.id} variant={binding.status === "enabled" ? "default" : "secondary"}>
          {binding.status === "enabled" ? "已启用" : "已停用"}
        </Badge>
      ))}
    </div>
  );
}

function VerificationStatus({ item }: { item: ChannelModelInventoryItem }) {
  if (item.bindings.length === 0) return <span className="text-muted-foreground text-sm">待绑定</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {item.bindings.map((binding) => {
        const verification = binding.verification;
        const succeeded = verification?.status === "succeeded" && verification.current;
        const failed = verification?.current && !succeeded;
        return (
          <span
            key={binding.id}
            className={failed ? "text-destructive text-xs font-medium" : "text-xs"}
          >
            {!verification ? "未验证" : !verification.current ? "已过期" : succeeded ? "验证通过" : "验证失败"}
            {verification?.latency_ms != null ? ` · ${verification.latency_ms}ms` : ""}
          </span>
        );
      })}
    </div>
  );
}

function InventoryActions({
  item,
  busy,
  channelId,
  onBind,
  onManualBind,
  onVerify,
  onStatus,
  onRemap,
  onAdopted,
}: {
  item: ChannelModelInventoryItem;
  busy: boolean;
  channelId: number;
  onBind: (model: InventoryModelCandidate, upstream: string) => void;
  onManualBind: (upstream: string) => void;
  onVerify: (binding: ChannelModelInventoryBinding) => void;
  onStatus: (binding: ChannelModelInventoryBinding, status: string) => void;
  onRemap: (binding: ChannelModelInventoryBinding) => void;
  onAdopted: () => void;
}) {
  if (item.bindings.length > 0) {
    return item.bindings.map((binding) => {
      const canEnable =
        binding.model_status === "enabled" &&
        binding.verification?.current &&
        binding.verification.status === "succeeded";
      return (
        <DropdownMenu key={binding.id}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`模型操作：${binding.model_display_name}`}
              disabled={busy}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuItem onSelect={() => onVerify(binding)}>验证</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRemap(binding)}>更换上游</DropdownMenuItem>
            <DropdownMenuItem
              disabled={binding.status !== "enabled" && !canEnable}
              onSelect={() =>
                onStatus(binding, binding.status === "enabled" ? "disabled" : "enabled")
              }
            >
              {binding.status === "enabled" ? "停用" : "启用"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    });
  }

  const direct = item.match.exact_model ?? singleAdoptedModel(item);
  if (direct) {
    return (
      <Button type="button" size="xs" disabled={busy} onClick={() => onBind(direct, item.upstream_model)}>
        绑定匹配模型
      </Button>
    );
  }

  if (item.match.catalog_candidates.length > 0) {
    return (
      <CatalogCandidateActions
        candidates={item.match.catalog_candidates}
        channelId={channelId}
        upstreamModel={item.upstream_model}
        onCompleted={onAdopted}
      />
    );
  }

  return (
    <Button type="button" size="xs" variant="outline" onClick={() => onManualBind(item.upstream_model)}>
      选择本地模型
    </Button>
  );
}

function singleAdoptedModel(item: ChannelModelInventoryItem): InventoryModelCandidate | null {
  if (item.match.kind !== "adopted_model") return null;
  return item.match.catalog_candidates[0]?.adopted_models[0] ?? null;
}

function CatalogCandidateActions({
  candidates,
  channelId,
  upstreamModel,
  onCompleted,
}: {
  candidates: InventoryCatalogCandidate[];
  channelId: number;
  upstreamModel: string;
  onCompleted: () => void;
}) {
  const [choiceOpen, setChoiceOpen] = useState(false);
  if (candidates.length === 1) {
    return (
      <AdoptFromCatalogDialog
        canonicalId={candidates[0].canonical_id}
        channelId={channelId}
        upstreamModel={upstreamModel}
        onCompleted={onCompleted}
      >
        <Button type="button" size="xs">采纳并绑定</Button>
      </AdoptFromCatalogDialog>
    );
  }
  return (
    <>
      <Button type="button" size="xs" onClick={() => setChoiceOpen(true)}>选择参考模型</Button>
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择参考模型</DialogTitle>
            <DialogDescription>存在多个目录匹配，确认正确条目后再采纳并创建停用绑定。</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {candidates.map((candidate) => (
              <div key={candidate.canonical_id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{candidate.display_name}</div>
                  <code className="text-muted-foreground break-all text-xs">{candidate.canonical_id}</code>
                </div>
                <AdoptFromCatalogDialog
                  canonicalId={candidate.canonical_id}
                  channelId={channelId}
                  upstreamModel={upstreamModel}
                  onCompleted={() => {
                    setChoiceOpen(false);
                    onCompleted();
                  }}
                >
                  <Button type="button" size="sm">采纳</Button>
                </AdoptFromCatalogDialog>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManualBindingDialog({
  open,
  onOpenChange,
  channelId,
  upstreamModel,
  onBound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: number;
  upstreamModel: string;
  onBound: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <ManualBindingForm
            channelId={channelId}
            initialUpstream={upstreamModel}
            onDone={() => {
              onBound();
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ManualBindingForm({ channelId, initialUpstream, onDone }: { channelId: number; initialUpstream: string; onDone: () => void }) {
  const [modelId, setModelId] = useState("");
  const [upstream, setUpstream] = useState(initialUpstream);
  const modelsQuery = useQuery({
    queryKey: ["models", "options", "all-statuses"],
    queryFn: async () => {
      const [enabled, disabled] = await Promise.all([listAllModels("enabled"), listAllModels("disabled")]);
      return [...enabled, ...disabled].sort((a, b) => a.model_id.localeCompare(b.model_id));
    },
  });
  const mutation = useMutation({
    mutationFn: () => bindChannelModels(channelId, [{ model_id: Number(modelId), upstream_model: upstream.trim() }]),
    onSuccess: () => {
      toast.success("已创建停用绑定");
      onDone();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>手工绑定模型</DialogTitle>
        <DialogDescription>用于上游不支持模型发现，或发现结果无法匹配本地模型的情况。新绑定固定停用。</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <label className="grid gap-2 text-sm">
          本地模型
          <Select value={modelId} onValueChange={setModelId} disabled={modelsQuery.isPending}>
            <SelectTrigger className="w-full" aria-label="本地模型"><SelectValue placeholder="选择模型" /></SelectTrigger>
            <SelectContent>
              {(modelsQuery.data ?? []).map((model: Model) => (
                <SelectItem key={model.id} value={String(model.id)}>
                  {model.model_id} · {model.display_name}{model.status !== "enabled" ? "（模型停用）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-sm">
          上游模型 ID
          <Input value={upstream} onChange={(event) => setUpstream(event.target.value)} placeholder="例如 gpt-4.1-mini" />
        </label>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
        <Button
          type="button"
          disabled={!modelId || !upstream.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          创建停用绑定
        </Button>
      </DialogFooter>
    </>
  );
}

function VerifyAndRemapDialog({
  open,
  onOpenChange,
  channelId,
  binding,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: number;
  binding: ChannelModelInventoryBinding | null;
  onChanged: () => void;
}) {
  const [upstream, setUpstream] = useState(binding?.upstream_model ?? "");
  useEffect(() => setUpstream(binding?.upstream_model ?? ""), [binding]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!binding) throw new Error("绑定不存在");
      let result = await createChannelModelVerification(channelId, [
        { model_id: binding.model_id, upstream_model: upstream.trim() },
      ]);
      for (let attempt = 0; attempt < 90 && !isTerminalRun(result.run.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        result = await getChannelModelVerification(channelId, result.run.id);
      }
      const item = result.items.find(
        (candidate) => candidate.model_id === binding.model_id && candidate.upstream_model === upstream.trim(),
      );
      if (!item || item.status !== "succeeded" || !item.success) {
        throw new Error(item?.message ?? result.run.message ?? "候选上游模型验证失败");
      }
      return updateChannelModel({
        channelId,
        modelId: binding.model_id,
        upstream_model: upstream.trim(),
        status: binding.status,
        verification_item_id: item.id,
      });
    },
    onSuccess: () => {
      toast.success("候选上游模型验证通过，映射已更新");
      onChanged();
      onOpenChange(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>更换上游模型</DialogTitle>
          <DialogDescription>先用候选模型执行真实验证；只有验证通过才会更新映射，绑定启停状态保持不变。</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm">
          上游模型 ID
          <Input value={upstream} onChange={(event) => setUpstream(event.target.value)} disabled={mutation.isPending} />
        </label>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
          <Button
            type="button"
            disabled={!binding || !upstream.trim() || upstream.trim() === binding.upstream_model || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            验证并更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelPerformance({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const query = useQuery({
    queryKey: ["channel", channelId, "ops-models", range],
    queryFn: () => getChannelOpsModels(channelId, range),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const models = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => b.attempt_total - a.attempt_total),
    [query.data],
  );
  if (query.isPending && !query.data) return <TableSkeleton rows={5} cols={6} />;
  if (query.isError) return <ErrorBox message={apiErrorMessage(query.error)} />;
  if (models.length === 0) {
    return <SectionEmpty icon={ListFilterIcon} title="暂无运行数据" description="启用绑定并产生请求后，可在此查看模型表现" />;
  }
  return (
    <ConfigurableDataTable
      storageKey={`channel:${channelId}:models`}
      data={models}
      columns={channelOpsModelColumns()}
      columnLabels={CHANNEL_OPS_MODEL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      toolbarStart={<span className="text-muted-foreground text-sm tabular-nums">共 {models.length} 个模型</span>}
    />
  );
}

function DiscoveryHistory({ channelId, active }: { channelId: number; active: boolean }) {
  const query = useQuery({
    queryKey: ["channel", channelId, "model-discoveries"],
    queryFn: () => listChannelModelDiscoveries(channelId),
    enabled: active,
  });
  if (query.isPending) {
    return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
  }
  if (query.isError) return <ErrorBox message={apiErrorMessage(query.error)} />;
  if (query.data.items.length === 0) {
    return <SectionEmpty icon={HistoryIcon} title="暂无发现记录" description="运行一次上游模型发现后，记录会显示在这里" />;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[700px]">
        <TableHeader><TableRow><TableHead>时间</TableHead><TableHead>来源</TableHead><TableHead>状态</TableHead><TableHead>模型数</TableHead><TableHead>尝试</TableHead><TableHead>结果</TableHead></TableRow></TableHeader>
        <TableBody>
          {query.data.items.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="text-sm">{formatRelativeTime(run.created_at)}</TableCell>
              <TableCell>{run.source === "scheduled" ? "定时" : run.source === "setup" ? "新建流程" : "手工"}</TableCell>
              <TableCell><RunStatus status={run.status} /></TableCell>
              <TableCell className="tabular-nums">{run.total_count}</TableCell>
              <TableCell className="tabular-nums">{run.attempt_count}</TableCell>
              <TableCell className="text-muted-foreground max-w-72 truncate text-sm">{run.message ?? run.warning_code ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RunStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    queued: "排队中",
    running: "进行中",
    succeeded: "成功",
    failed: "失败",
    stale: "已过期",
  };
  return <Badge variant={status === "succeeded" ? "default" : status === "failed" ? "destructive" : "secondary"}>{labels[status] ?? status}</Badge>;
}
