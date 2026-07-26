import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";
import {
  ActivityIcon,
  ArchiveIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Settings2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createProviderOrigin,
  getProviderOriginRuntime,
  listProviderOrigins,
  resetProviderOriginBreaker,
  updateProviderOriginBaseURL,
  updateProviderOriginName,
  updateProviderOriginStatus,
  type CreatableProviderOriginStatus,
  type ProviderOrigin,
  type ProviderOriginStatus,
} from "@/lib/api/providerOrigins";
import type { RuntimeSyncState } from "@/lib/api/runtime";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { FieldHint, HintLabel } from "@/components/common/field-hint";
import { CopyChannelsToOriginDialog } from "@/components/providers/CopyChannelsToOriginDialog";
import { ErrorBox } from "@/components/common/detail-section";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { providerOriginColumns } from "@/components/providers/provider-origins-columns";
import { DataTable } from "@/components/tablecn/data-table";
import { DataTableSkeleton } from "@/components/tablecn/data-table-skeleton";
import { DataTableToolbar } from "@/components/tablecn/data-table-toolbar";
import { useDataTable } from "@/components/tablecn/hooks/use-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const ENDPOINTS_QUERY_KEY = "provider-origins";
const PAGE_SIZE = 20;

const ORIGINS_QUERY_KEYS = {
  page: "originsPage",
  perPage: "originsPerPage",
  sort: "originsSort",
} as const;

const RUNTIME_SYNC_COPY: Record<
  RuntimeSyncState,
  { label: string; description: string }
> = {
  active: { label: "已同步", description: "数据库版本与 Redis 运行态一致。" },
  runtime_sync_pending: {
    label: "配置同步中",
    description: "数据库已提交，Redis 运行态尚未确认；新上游准入已拒绝。",
  },
  runtime_sync_required: {
    label: "待建立运行态",
    description: "运行态 control 缺失；新上游准入已拒绝。",
  },
  stale: {
    label: "运行态已过期",
    description: "数据库与 Redis revision 不一致；旧快照不作为当前事实展示。",
  },
  store_unavailable: {
    label: "基础设施故障",
    description: "Redis 或 BreakerStore 不可用；新上游准入已拒绝。",
  },
  runtime_state_lost: {
    label: "运行态完整性丢失",
    description: "完整性门禁未恢复；新上游准入已拒绝。",
  },
};

function endpointSyncState(endpoint: ProviderOrigin): RuntimeSyncState {
  if (endpoint.runtime_sync_state) return endpoint.runtime_sync_state;
  return endpoint.runtime_sync_pending ? "runtime_sync_pending" : "active";
}

function formatRevision(revision: number | null | undefined): string {
  return revision == null || revision <= 0 ? "—" : `v${revision}`;
}

function OriginRuntimeSyncCell({ endpoint }: { endpoint: ProviderOrigin }) {
  const state = endpointSyncState(endpoint);
  const copy = RUNTIME_SYNC_COPY[state];
  const dbURL = endpoint.base_url_revision;
  const dbStatus = endpoint.status_revision;
  const redisURL = endpoint.runtime_active_base_url_revision;
  const redisStatus = endpoint.runtime_active_status_revision;
  const urlSynced = redisURL != null && redisURL === dbURL;
  const statusSynced = redisStatus != null && redisStatus === dbStatus;
  const revisionsSynced = urlSynced && statusSynced;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default"
          aria-label={`${copy.label}；查看修订详情`}
        >
          <RuntimeSyncBadge state={state} />
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-xs font-medium">{copy.label}</div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {copy.description}
            </p>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground text-[10px]">数据库</div>
            <div className="mt-0.5 text-xs tabular-nums">
              地址 {formatRevision(dbURL)} · 状态 {formatRevision(dbStatus)}
            </div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground text-[10px]">Redis 运行态</div>
            <div className="mt-0.5 text-xs tabular-nums">
              地址 {formatRevision(redisURL)} · 状态 {formatRevision(redisStatus)}
            </div>
          </div>
          <p className="text-muted-foreground text-[11px] leading-snug">
            {revisionsSynced
              ? "修订号两边一致；改地址或状态后会 +1。"
              : "数据库与 Redis 修订号不一致，以数据库为准等待同步。"}
          </p>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

function OriginRowActions({
  providerId,
  endpoint,
}: {
  providerId: number;
  endpoint: ProviderOrigin;
}) {
  return (
    <div className="flex gap-1">
      <OriginRuntimeDialog endpoint={endpoint} />
      <CopyChannelsToOriginDialog targetOrigin={endpoint} />
      <OriginStatusActions endpoint={endpoint} />
      <ProviderOriginFormDialog providerId={providerId} endpoint={endpoint}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`编辑 ${endpoint.name}`}
          title={
            endpointSyncState(endpoint) === "active"
              ? `编辑 ${endpoint.name}`
              : "运行态未同步，暂不能修改"
          }
          disabled={endpointSyncState(endpoint) !== "active"}
        >
          <Settings2Icon />
        </Button>
      </ProviderOriginFormDialog>
    </div>
  );
}

export function ProviderOriginsSection({
  providerId,
}: {
  providerId: number;
}) {
  const [page] = useQueryState(
    ORIGINS_QUERY_KEYS.page,
    parseAsInteger.withDefault(1),
  );
  const [perPage] = useQueryState(
    ORIGINS_QUERY_KEYS.perPage,
    parseAsInteger.withDefault(PAGE_SIZE),
  );
  const [statusFilter] = useQueryState(
    "origin_status",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [nameFilter] = useQueryState(
    "origin_name",
    parseAsString.withDefault(""),
  );

  const status = (statusFilter[0] ?? "") as ProviderOriginStatus | "";
  const q = nameFilter.trim();

  const columns = useMemo(
    () =>
      providerOriginColumns({
        RuntimeSyncCell: OriginRuntimeSyncCell,
        BreakerCell: OriginBreakerCell,
        ErrorRateCell: OriginErrorRateCell,
        Actions: ({ endpoint }) => (
          <OriginRowActions providerId={providerId} endpoint={endpoint} />
        ),
      }),
    [providerId],
  );

  const query = useQuery({
    queryKey: [
      ENDPOINTS_QUERY_KEY,
      "by-provider",
      providerId,
      "tablecn",
      { status, q, page, perPage },
    ],
    queryFn: () =>
      listProviderOrigins({
        providerId,
        status: status || undefined,
        q: q || undefined,
        page,
        pageSize: perPage,
      }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const { table } = useDataTable({
    data: items,
    columns,
    pageCount,
    queryKeys: ORIGINS_QUERY_KEYS,
    initialState: {
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
    },
    getRowId: (row) => String(row.id),
  });

  if (query.isError) {
    return <ErrorBox message={apiErrorMessage(query.error)} />;
  }

  if (query.isPending && items.length === 0) {
    return <DataTableSkeleton columnCount={columns.length} rowCount={6} />;
  }

  return (
    <DataTable
      table={table}
      emptyMessage={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>暂无源站</EmptyTitle>
            <EmptyDescription>
              创建一个上游 API Root 后，渠道才能绑定并参与路由
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <DataTableToolbar
        table={table}
        leading={
          <ProviderOriginFormDialog providerId={providerId}>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              新建源站
            </Button>
          </ProviderOriginFormDialog>
        }
      />
    </DataTable>
  );
}

export function ProviderOriginFormDialog({
  providerId,
  endpoint,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  providerId: number;
  endpoint?: ProviderOrigin;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [status, setStatus] =
    useState<CreatableProviderOriginStatus>("enabled");
  const [errors, setErrors] = useState<{ name?: string; base_url?: string }>(
    {},
  );
  const queryClient = useQueryClient();

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  useEffect(() => {
    if (!open) return;
    setName(endpoint?.name ?? "");
    setBaseURL(endpoint?.base_url ?? "");
    setStatus(endpoint?.status === "disabled" ? "disabled" : "enabled");
    setErrors({});
  }, [endpoint, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!endpoint) {
        return createProviderOrigin({
          provider_id: providerId,
          name: name.trim(),
          base_url: baseURL.trim(),
          status,
        });
      }

      let saved = endpoint;
      if (name.trim() !== endpoint.name) {
        saved = await updateProviderOriginName(endpoint.id, name.trim());
      }
      if (baseURL.trim() !== endpoint.base_url) {
        saved = await updateProviderOriginBaseURL(
          endpoint.id,
          baseURL.trim(),
        );
      }
      return saved;
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: [ENDPOINTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["providers"] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success(
        endpointSyncState(saved) !== "active"
          ? `源站「${saved.name}」已保存，运行态同步待恢复`
          : endpoint
            ? `已保存源站「${saved.name}」`
            : `已创建源站「${saved.name}」`,
      );
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: { name?: string; base_url?: string } = {};
    if (!name.trim()) next.name = "名称不能为空";
    if (!isValidOriginURL(baseURL.trim())) {
      next.base_url = "请输入不含参数或片段的 http(s) API Root";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {endpoint ? "编辑源站" : "新建源站"}
          </DialogTitle>
          <DialogDescription>
            一个源站对应一个上游 API Root，也是独立熔断的公共故障域。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <HintLabel
                htmlFor="origin_name"
                hint="同一服务商下用于区分上游入口的名称。"
              >
                名称
              </HintLabel>
              <Input
                id="origin_name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="primary"
                aria-invalid={!!errors.name}
                autoFocus
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.base_url}>
              <HintLabel
                htmlFor="origin_base_url"
                hint="API Root 由源站独占；修改后地址版本递增，旧请求结果不会污染新运行态。"
              >
                API Root
              </HintLabel>
              <Input
                id="origin_base_url"
                value={baseURL}
                onChange={(event) => setBaseURL(event.target.value)}
                placeholder="https://api.example.com/v1"
                aria-invalid={!!errors.base_url}
              />
              <FieldError>{errors.base_url}</FieldError>
            </Field>
            {!endpoint ? (
              <Field>
                <HintLabel
                  htmlFor="origin_status"
                  hint="停用后该源站下的新渠道尝试不再准入。"
                >
                  状态
                </HintLabel>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as CreatableProviderOriginStatus)
                  }
                >
                  <SelectTrigger id="origin_status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="enabled">启用</SelectItem>
                      <SelectItem value="disabled">停用</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {mutation.isPending ? "保存中..." : endpoint ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OriginStatusActions({ endpoint }: { endpoint: ProviderOrigin }) {
  const [nextStatus, setNextStatus] = useState<ProviderOriginStatus>();
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: (status: ProviderOriginStatus) =>
      updateProviderOriginStatus(endpoint.id, status),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: [ENDPOINTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      const action =
        saved.status === "enabled"
          ? "启用"
          : saved.status === "disabled"
            ? endpoint.status === "archived"
              ? "恢复"
              : "停用"
            : "归档";
      toast.success(
        endpointSyncState(saved) !== "active"
          ? `源站「${saved.name}」已${action}，运行态同步待恢复`
          : `已${action}源站「${saved.name}」`,
      );
      setNextStatus(undefined);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const archived = endpoint.status === "archived";
  const runtimeConflicted = endpointSyncState(endpoint) !== "active";
  const toggleStatus: ProviderOriginStatus = archived
    ? "disabled"
    : endpoint.status === "enabled"
      ? "disabled"
      : "enabled";
  const ToggleIcon = archived
    ? Undo2Icon
    : endpoint.status === "enabled"
      ? CirclePauseIcon
      : CirclePlayIcon;
  const toggleLabel = archived
    ? "恢复为停用"
    : endpoint.status === "enabled"
      ? "停用"
      : "启用";

  const confirmTitle =
    nextStatus === "archived"
      ? "归档源站"
      : nextStatus === "enabled"
        ? "启用源站"
        : archived
          ? "恢复源站"
          : "停用源站";
  const confirmDescription =
    nextStatus === "archived"
      ? `确认归档「${endpoint.name}」？只有未绑定渠道的源站才能归档。`
      : nextStatus === "enabled"
        ? `确认启用「${endpoint.name}」？运行态同步完成后，其下符合条件的渠道可参与路由。`
        : archived
          ? `确认恢复「${endpoint.name}」为停用？恢复后不会自动参与路由。`
          : `确认停用「${endpoint.name}」？其下渠道的新上游尝试将停止准入。`;

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`${toggleLabel} ${endpoint.name}`}
        title={
          runtimeConflicted
            ? "运行态未同步，暂不能修改状态"
            : `${toggleLabel} ${endpoint.name}`
        }
        disabled={runtimeConflicted}
        onClick={() => setNextStatus(toggleStatus)}
      >
        <ToggleIcon />
      </Button>
      {!archived ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`归档 ${endpoint.name}`}
          title={
            endpoint.channel_count > 0
              ? `仍绑定 ${endpoint.channel_count} 个渠道，不能归档`
              : `归档 ${endpoint.name}`
          }
          disabled={runtimeConflicted || endpoint.channel_count > 0}
          onClick={() => setNextStatus("archived")}
        >
          <ArchiveIcon />
        </Button>
      ) : null}
      <ConfirmActionDialog
        open={nextStatus != null}
        onOpenChange={(open) => {
          if (!open) setNextStatus(undefined);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={
          nextStatus === "archived" ? "确认归档" : `确认${toggleLabel}`
        }
        destructive={nextStatus === "archived" || nextStatus === "disabled"}
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (nextStatus) statusMutation.mutate(nextStatus);
        }}
      />
    </>
  );
}

function OriginRuntimeDialog({ endpoint }: { endpoint: ProviderOrigin }) {
  const [open, setOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const syncState = endpointSyncState(endpoint);
  const runtime = useQuery({
    queryKey: [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
    queryFn: () => getProviderOriginRuntime(endpoint.id),
    enabled: open && syncState === "active",
    retry: 1,
  });
  const reset = useMutation({
    mutationFn: () => resetProviderOriginBreaker(endpoint.id),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(
        [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
        snapshot,
      );
      toast.success(`已复位源站「${endpoint.name}」熔断状态`);
      setResetConfirmOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const snapshot = runtime.data;
  const stateLabel = !snapshot?.exists
    ? "无运行样本"
    : snapshot.state === "half_open"
      ? "半开"
      : snapshot.state === "open"
        ? "熔断"
        : "关闭";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`查看 ${endpoint.name} 运行态`}
            title={`查看 ${endpoint.name} 运行态`}
          >
            <ActivityIcon />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{endpoint.name} 运行态</DialogTitle>
            <DialogDescription>{endpoint.base_url}</DialogDescription>
          </DialogHeader>

          {syncState !== "active" ? (
            <Alert variant="destructive">
              <AlertTitle>{RUNTIME_SYNC_COPY[syncState].label}</AlertTitle>
              <AlertDescription>
                {RUNTIME_SYNC_COPY[syncState].description}
                旧快照不作为当前事实展示。
              </AlertDescription>
            </Alert>
          ) : runtime.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : runtime.isError ? (
            <Alert variant="destructive">
              <AlertTitle>运行态不可用</AlertTitle>
              <AlertDescription>
                基础设施故障，新的上游准入已拒绝。
                {apiErrorMessage(runtime.error)}
              </AlertDescription>
            </Alert>
          ) : snapshot && !snapshot.exists ? (
            <Alert>
              <AlertTitle>无运行样本</AlertTitle>
              <AlertDescription>
                Redis 查询成功，但当前源站尚未产生可展示的熔断样本。
              </AlertDescription>
            </Alert>
          ) : snapshot ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <RuntimeFact label="熔断状态" value={stateLabel} />
              <RuntimeFact
                label="错误率"
                value={formatPercent(snapshot.error_rate)}
              />
              <RuntimeFact
                label="成功 / 失败"
                value={`${snapshot.eligible_successes} / ${snapshot.eligible_failures}`}
              />
              <RuntimeFact
                label="窗口样本"
                value={String(snapshot.sample_count)}
              />
              <RuntimeFact
                label="连续失败"
                value={String(snapshot.consecutive_failures)}
              />
              <RuntimeFact
                label="打开剩余"
                value={
                  snapshot.state === "open"
                    ? `${snapshot.open_remaining_ms} ms`
                    : "—"
                }
              />
            </dl>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                关闭
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={
                reset.isPending ||
                syncState !== "active" ||
                runtime.isPending ||
                runtime.isError
              }
              onClick={() => setResetConfirmOpen(true)}
            >
              <RotateCcwIcon data-icon="inline-start" />
              复位熔断
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="复位源站熔断状态"
        description={`确认复位「${endpoint.name}」？当前熔断窗口和连续失败计数将被清空。`}
        confirmLabel="确认复位"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </>
  );
}

function useOriginRuntimeQuery(endpoint: ProviderOrigin) {
  const syncState = endpointSyncState(endpoint);
  const runtime = useQuery({
    queryKey: [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
    queryFn: () => getProviderOriginRuntime(endpoint.id),
    enabled: syncState === "active",
    refetchInterval: syncState === "active" ? 5_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  return { syncState, runtime };
}

function OriginBreakerCell({ endpoint }: { endpoint: ProviderOrigin }) {
  const { syncState, runtime } = useOriginRuntimeQuery(endpoint);

  if (syncState !== "active") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (runtime.isPending) return <Spinner className="size-4" />;
  if (runtime.isError) {
    return (
      <span
        className="text-destructive text-xs"
        title={apiErrorMessage(runtime.error)}
      >
        基础设施故障
      </span>
    );
  }
  if (!runtime.data.exists) {
    return <Badge variant="outline">无运行样本</Badge>;
  }

  const snapshot = runtime.data;
  const stateLabel =
    snapshot.state === "closed"
      ? "闭合"
      : snapshot.state === "half_open"
        ? "半开"
        : "熔断中";

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex cursor-default items-center gap-1.5 text-xs tabular-nums"
          aria-label={`熔断 ${stateLabel}；查看详情`}
        >
          <Badge
            variant={snapshot.state === "closed" ? "secondary" : "destructive"}
          >
            {stateLabel}
          </Badge>
          {snapshot.state === "open" ? (
            <span className="text-muted-foreground">
              {Math.ceil(snapshot.open_remaining_ms / 1_000)} 秒
            </span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-64">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs font-medium">熔断详情</div>
          <div className="grid gap-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">状态</span>
              <span className="tabular-nums">{stateLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                打开层级
                <FieldHint text="熔断退避档位。连续熔断会升高，打开时长按配置逐步加长；成功恢复闭合后清零。" />
              </span>
              <span className="tabular-nums">{snapshot.open_level}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">连续失败</span>
              <span className="tabular-nums">{snapshot.consecutive_failures}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">成功 / 失败</span>
              <span className="tabular-nums">
                {snapshot.eligible_successes} / {snapshot.eligible_failures}
              </span>
            </div>
            {snapshot.state === "open" ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">打开剩余</span>
                <span className="tabular-nums">
                  {Math.ceil(snapshot.open_remaining_ms / 1_000)} 秒
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

function OriginErrorRateCell({ endpoint }: { endpoint: ProviderOrigin }) {
  const { syncState, runtime } = useOriginRuntimeQuery(endpoint);

  if (syncState !== "active") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (runtime.isPending) return <Spinner className="size-4" />;
  if (runtime.isError || !runtime.data.exists) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const snapshot = runtime.data;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default text-xs tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`错误率 ${formatPercent(snapshot.error_rate)}；查看详情`}
        >
          {formatPercent(snapshot.error_rate)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-56">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs font-medium">错误率详情</div>
          <div className="grid gap-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">错误率</span>
              <span className="tabular-nums">{formatPercent(snapshot.error_rate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">样本数</span>
              <span className="tabular-nums">{snapshot.sample_count}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">错误次数</span>
              <span className="tabular-nums">{snapshot.eligible_failures}</span>
            </div>
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

function RuntimeSyncBadge({ state }: { state: RuntimeSyncState }) {
  return (
    <Badge variant={state === "active" ? "outline" : "destructive"}>
      {RUNTIME_SYNC_COPY[state].label}
    </Badge>
  );
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function isValidOriginURL(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
