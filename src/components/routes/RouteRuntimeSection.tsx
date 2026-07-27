import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  ServerIcon,
} from "lucide-react";
import {
  getRouteOpsReachableModels,
  getRouteRoutingDecisions,
  getRouteRuntime,
  type RouteRuntime,
  type RouteRuntimeChannel,
  type RoutingCandidateScore,
  type RoutingDecision,
} from "@/lib/api/routesOps";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";
import {
  formatCompact,
  formatDateTime,
  formatLatencyMs,
  formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQueryState } from "nuqs";
import { getSortingStateParser } from "@/components/tablecn/lib/parsers";
import { sortingToApiSort } from "@/lib/api/list-params";
import { RefreshControl } from "@/components/common/RefreshControl";
import { useRefreshSettings } from "@/hooks/useRefreshSettings";
import {
  ErrorBox,
  SectionEmpty,
  TableSkeleton,
} from "@/components/common/detail-section";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DetailSheetContent,
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetMain,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/tablecn/data-table";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { useDataTable } from "@/components/tablecn/hooks/use-data-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STALE_AFTER_MS = 10_000;
const DECISION_PAGE_SIZE = 20;

const EXCLUSION_LABELS: Record<string, string> = {
  route_disabled: "线路停用",
  route_archived: "线路已归档",
  channel_disabled: "渠道停用",
  channel_archived: "渠道已归档",
  provider_disabled: "服务商停用",
  provider_archived: "服务商已归档",
  credential_invalid: "凭据失效",
  credential_missing: "缺少凭据",
  base_url_missing: "缺少上游地址",
  protocol_mismatch: "协议不匹配",
  model_not_found: "模型不存在",
  model_disabled: "模型停用",
  model_not_bound: "未绑定模型",
  binding_disabled: "模型绑定停用",
  model_price_missing: "缺少模型售价",
  channel_cost_missing: "缺少渠道成本",
  pricing_invalid: "价格配置无效",
  capability_unsupported: "能力不支持",
  breaker_open: "熔断中",
  breaker_half_open_busy: "半开探测占用中",
  cooldown: "429 冷却中",
  rate_limited: "429 冷却中",
  model_permission: "模型权限暂停",
  model_permission_paused: "模型权限暂停",
  stale_revision: "运行态版本不一致",
  stale_status_revision: "源站 状态版本不一致",
  stale_config_revision: "渠道配置版本不一致",
  breaker_or_cooldown: "熔断或冷却中",
  not_in_candidate_plan: "未进入候选计划",
};

const ABNORMAL_LABELS: Record<string, string> = {
  fallback: "发生回退",
  all_capacity_zero: "全部容量耗尽",
  sticky_invalid: "粘性渠道失效",
  negative_margin: "负毛利拦截",
};

const RUNTIME_SYNC_LABELS: Record<string, string> = {
  active: "运行态已同步",
  runtime_sync_pending: "配置同步中",
  runtime_sync_required: "待建立运行态",
  stale: "运行态已过期",
  store_unavailable: "基础设施故障",
  runtime_state_lost: "运行态完整性丢失",
  revision_mismatch: "版本不一致",
};

const PERMISSION_RECHECK_LABELS: Record<string, string> = {
  queued: "待复检",
  checking: "复检中",
  retry_wait: "等待重试",
  cleared: "已恢复",
  stale: "配置已变更",
  invalid: "状态异常",
  recheck_required: "必须复检",
  unavailable: "事实不可用",
};

function reasonLabel(reason: string): string {
  return (
    EXCLUSION_LABELS[reason] ??
    ABNORMAL_LABELS[reason] ??
    reason.replaceAll("_", " ")
  );
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const onVisibilityChange = () =>
      setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return visible;
}

function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}

function useRefreshOnVisible(visible: boolean, refresh: () => void) {
  const previous = useRef(visible);
  useEffect(() => {
    if (visible && !previous.current) refresh();
    previous.current = visible;
  }, [refresh, visible]);
}

function isObservationStale(runtime: RouteRuntime, now: number): boolean {
  const observedAt = Date.parse(runtime.observed_at);
  return (
    runtime.stale ||
    !Number.isFinite(observedAt) ||
    now - observedAt > STALE_AFTER_MS
  );
}

function formatCapacity(used: number, limit: number): string {
  return limit > 0
    ? `${formatCompact(used)} / ${formatCompact(limit)}`
    : `${formatCompact(used)} / 不限`;
}

function formatRuntimeRevision(revision: number | null | undefined): string {
  return revision != null && revision > 0 ? `r${revision}` : "—";
}

function permissionStateLabel(state: string): string {
  return (
    PERMISSION_RECHECK_LABELS[state] ??
    (state ? state.replaceAll("_", " ") : "未知")
  );
}

function marginStatusLabel(state: string): string {
  if (state === "safe") return "安全";
  if (state === "negative_margin") return "负毛利";
  if (state === "pricing_invalid") return "价格无效";
  return "未评估";
}

function runtimeStateForChannel(
  channel: RouteRuntimeChannel,
  infrastructureDenied: boolean,
): string {
  if (infrastructureDenied) return "store_unavailable";
  if (channel.runtime_sync_state !== "active") {
    return channel.runtime_sync_state;
  }
  if (channel.runtime_control_state !== "active") {
    return channel.runtime_control_state;
  }
  if (
    !channel.origin_revision_current ||
    !channel.provider_status_revision_current ||
    (channel.runtime_channel_config_revision != null &&
      !channel.channel_config_revision_current) ||
    !channel.channel_admission_limits_revision_current ||
    !channel.runtime_revision_current
  ) {
    return "revision_mismatch";
  }
  return "active";
}

function channelLabel(channelId: number, names: Map<number, string>): string {
  const name = names.get(channelId);
  return name ? `${name} (#${channelId})` : `渠道 #${channelId}`;
}

function upstreamEndpointLabel(endpoint: string): string {
  const labels: Record<string, string> = {
    chat_completions: "Chat Completions",
    responses: "Responses",
    responses_compact: "Responses Compact",
    messages: "Messages",
  };
  return labels[endpoint] ?? endpoint.replaceAll("_", " ");
}

function chainItemLabel(item: unknown, names: Map<number, string>): string {
  if (typeof item === "number") return channelLabel(item, names);
  if (typeof item === "object" && item !== null && "channel_id" in item) {
    const channelId = Number((item as { channel_id: unknown }).channel_id);
    if (Number.isFinite(channelId)) {
      const channel = channelLabel(channelId, names);
      if ("upstream_endpoint" in item) {
        const endpoint = (item as { upstream_endpoint: unknown })
          .upstream_endpoint;
        if (typeof endpoint === "string" && endpoint !== "") {
          return `${channel} · ${upstreamEndpointLabel(endpoint)}`;
        }
      }
      return channel;
    }
  }
  return typeof item === "string" ? item : JSON.stringify(item);
}

export function RouteRuntimeSection({ routeId }: { routeId: number }) {
  const visible = useDocumentVisible();
  const now = useClock(visible);
  const [modelId, setModelId] = useState("");
  const [protocol, setProtocol] = useState<"" | "openai" | "anthropic">("");
  const [selectedDecision, setSelectedDecision] =
    useState<RoutingDecision | null>(null);
  // 与子表 useDataTable 共用同一 URL 键（rtSort），把排序透传到服务端查询。
  const [runtimeSorting] = useQueryState(
    "rtSort",
    getSortingStateParser<RouteRuntimeChannel>().withDefault([
      { id: "order", desc: false },
    ]),
  );
  const runtimeSort = sortingToApiSort(runtimeSorting);
  const { autoRefresh, intervalSec, setAutoRefresh, setIntervalSec } =
    useRefreshSettings("route-runtime", { autoRefresh: true, intervalSec: 1 });

  const modelsQuery = useQuery({
    queryKey: ["route", routeId, "ops-reachable-models"],
    queryFn: () => getRouteOpsReachableModels(routeId),
    staleTime: 60_000,
  });

  const models = useMemo(
    () =>
      [...(modelsQuery.data ?? [])].sort((a, b) =>
        a.model_id.localeCompare(b.model_id),
      ),
    [modelsQuery.data],
  );

  useEffect(() => {
    if (models.length === 0) {
      setModelId("");
      return;
    }
    if (!models.some((model) => model.model_id === modelId)) {
      setModelId(models[0].model_id);
    }
  }, [modelId, models]);

  const runtimeQuery = useQuery({
    queryKey: ["route", routeId, "ops-runtime", modelId, protocol, runtimeSort],
    queryFn: () =>
      getRouteRuntime(routeId, {
        model_id: modelId,
        protocol: protocol || undefined,
        sort: runtimeSort,
      }),
    enabled: modelId !== "",
    placeholderData: keepPreviousData,
    refetchInterval: visible && autoRefresh ? intervalSec * 1000 : false,
    refetchIntervalInBackground: false,
  });

  const decisionsQuery = useQuery({
    queryKey: ["route", routeId, "ops-decisions", 1],
    queryFn: () =>
      getRouteRoutingDecisions(routeId, {
        page: 1,
        page_size: DECISION_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: visible && autoRefresh ? intervalSec * 1000 : false,
    refetchIntervalInBackground: false,
  });

  const refresh = () => {
    void runtimeQuery.refetch();
    void decisionsQuery.refetch();
  };
  useRefreshOnVisible(visible, refresh);

  if (modelsQuery.isPending) return <TableSkeleton rows={6} cols={6} />;
  if (modelsQuery.isError)
    return <ErrorBox message={(modelsQuery.error as Error).message} />;
  if (models.length === 0) {
    return (
      <SectionEmpty
        icon={ActivityIcon}
        title="没有可路由模型"
        description="检查线路渠道池的模型绑定、售价和渠道成本配置"
      />
    );
  }

  const runtime = runtimeQuery.data;
  const stale = runtime ? isObservationStale(runtime, now) : false;
  const infrastructureDenied = runtime
    ? runtime.breaker_store_admission === "denied" ||
      runtime.sources.some((source) => !source.available)
    : false;
  const refreshControl = (
    <RefreshControl
      autoRefresh={autoRefresh}
      intervalSec={intervalSec}
      onAutoRefreshChange={setAutoRefresh}
      onIntervalChange={setIntervalSec}
      onRefresh={refresh}
      spinning={
        autoRefresh || runtimeQuery.isFetching || decisionsQuery.isFetching
      }
    />
  );
  const channelNames = new Map(
    runtime?.channels.map((channel) => [
      channel.channel_id,
      channel.channel_name,
    ]) ?? [],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              模型
            </span>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.model_id} value={model.model_id}>
                    {model.display_name || model.model_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              协议
            </span>
            <Select
              value={protocol || "all"}
              onValueChange={(value) =>
                setProtocol(
                  value === "all" ? "" : (value as "openai" | "anthropic"),
                )
              }
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部协议</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {runtimeQuery.isError ? (
        <ErrorBox message={(runtimeQuery.error as Error).message} />
      ) : runtimeQuery.isPending && !runtime ? (
        <TableSkeleton rows={5} cols={7} />
      ) : runtime ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <RuntimeSources runtime={runtime} />
            {refreshControl}
          </div>
          {infrastructureDenied ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>基础设施故障，准入已拒绝</AlertTitle>
              <AlertDescription>
                Redis、BreakerStore 或运行态完整性不可用。当前
                breaker、容量和权重不作为实时事实展示。
              </AlertDescription>
            </Alert>
          ) : stale ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>运行态数据已陈旧</AlertTitle>
              <AlertDescription>
                最近观测超过 10 秒或共享运行态不可用，当前权重不能作为实时事实。
              </AlertDescription>
            </Alert>
          ) : null}

          <RuntimeSummary runtime={runtime} />
          <RouteUsageSummary runtime={runtime} />
          <RuntimeChannelTable
            channels={runtime.channels}
            mode={runtime.mode}
            infrastructureDenied={infrastructureDenied}
          />
        </>
      ) : null}

      <RecentDecisions
        decisions={decisionsQuery.data?.items ?? []}
        total={decisionsQuery.data?.total ?? 0}
        loading={decisionsQuery.isPending && !decisionsQuery.data}
        error={decisionsQuery.isError ? (decisionsQuery.error as Error) : null}
        channelNames={channelNames}
        onOpen={setSelectedDecision}
      />

      <RoutingDecisionSheet
        decision={selectedDecision}
        channelNames={channelNames}
        onOpenChange={(open) => {
          if (!open) setSelectedDecision(null);
        }}
      />
    </div>
  );
}

function RuntimeSummary({ runtime }: { runtime: RouteRuntime }) {
  return (
    <div className="grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <SummaryItem
        label="线路策略"
        value={ROUTE_MODE_LABEL[runtime.mode] ?? runtime.mode}
      />
      <SummaryItem
        label="线路配置"
        value={
          runtime.route_status === "enabled" ? "启用" : runtime.route_status
        }
      />
      <SummaryItem
        label="当前服务"
        value={`${runtime.candidate_count} / ${runtime.pool_size}`}
        danger={runtime.candidate_count === 0}
      />
      <SummaryItem
        label="冗余"
        value={runtime.no_redundancy ? "无冗余" : "可回退"}
        danger={runtime.no_redundancy}
      />
      <SummaryItem
        label="容量状态"
        value={
          runtime.breaker_store_admission !== "normal"
            ? "事实不可用"
            : runtime.all_capacity_zero
            ? "全部满载"
            : "正常"
        }
        danger={
          runtime.all_capacity_zero ||
          runtime.breaker_store_admission !== "normal"
        }
      />
      <SummaryItem
        label="运行态同步"
        value={
          RUNTIME_SYNC_LABELS[runtime.runtime_sync_state] ??
          runtime.runtime_sync_state
        }
        danger={runtime.runtime_sync_state !== "active"}
      />
      <SummaryItem
        label="准入基础设施"
        value={runtime.breaker_store_admission === "normal" ? "可用" : "已拒绝"}
        danger={runtime.breaker_store_admission !== "normal"}
      />
    </div>
  );
}

function RouteUsageSummary({ runtime }: { runtime: RouteRuntime }) {
  const usage = runtime.route_usage;
  const unavailable =
    runtime.breaker_store_admission !== "normal" || usage == null;

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-medium">
        线路实时合计（全用户）
      </div>
      {unavailable ? (
        <div className="rounded-lg border px-3 py-3">
          <div className="text-destructive text-sm font-semibold">
            事实不可用
          </div>
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="并发" value={formatCompact(usage.concurrency)} />
          <SummaryItem label="RPM" value={formatCompact(usage.rpm)} />
          <SummaryItem label="RPD" value={formatCompact(usage.rpd)} />
          <SummaryItem label="TPM" value={formatCompact(usage.tpm)} />
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="border-b px-3 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          danger && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RuntimeSources({ runtime }: { runtime: RouteRuntime }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <ServerIcon className="text-muted-foreground size-4" />
      <span className="text-muted-foreground">数据源</span>
      {runtime.sources.map((source) => (
        <Badge
          key={source.name}
          variant={
            source.available && !source.stale ? "outline" : "destructive"
          }
          title={
            source.observed_at
              ? formatDateTime(source.observed_at)
              : "无观测时间"
          }
        >
          {source.name} · {source.available && !source.stale ? "正常" : "异常"}
        </Badge>
      ))}
    </div>
  );
}

type CapacityDimension = {
  key: string;
  label: string;
  used: number;
  limit: number;
  remaining: number | null;
};

function capacityDimensions(channel: RouteRuntimeChannel): CapacityDimension[] {
  return [
    {
      key: "concurrency",
      label: "并发",
      used: channel.concurrency_used,
      limit: channel.concurrency_limit,
      remaining: channel.concurrency_remaining,
    },
    {
      key: "rpm",
      label: "RPM",
      used: channel.rpm_used,
      limit: channel.rpm_limit,
      remaining: channel.rpm_remaining,
    },
    {
      key: "rpd",
      label: "RPD",
      used: channel.rpd_used,
      limit: channel.rpd_limit,
      remaining: channel.rpd_remaining,
    },
    {
      key: "tpm",
      label: "TPM",
      used: channel.tpm_used,
      limit: channel.tpm_limit,
      remaining: channel.tpm_remaining,
    },
  ];
}

function dimensionRemaining(dim: CapacityDimension): number {
  if (dim.remaining == null) return 1;
  return Math.max(0, Math.min(1, dim.remaining));
}

// CapacityDimCell：单维余量条——满格绿=充足（含不限流），逼近上限缩短并转黄/红。
function CapacityDimCell({
  channel,
  dim,
  usable,
}: {
  channel: RouteRuntimeChannel;
  dim: CapacityDimension;
  usable: boolean;
}) {
  if (!usable) return <span className="text-muted-foreground">—</span>;
  if (channel.capacity_read_failed) {
    return <Badge variant="destructive">失败</Badge>;
  }

  const unlimited = dim.limit <= 0;
  const fraction = unlimited ? 1 : dimensionRemaining(dim);
  const tone =
    unlimited || fraction >= 0.5 ? "ok" : fraction >= 0.2 ? "warn" : "danger";
  const barClass =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-red-500";
  const width = Math.round(fraction * 100);
  const label = unlimited
    ? "不限"
    : formatCapacity(dim.used, dim.limit);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-full max-w-32 cursor-help items-center gap-1.5">
            <div className="bg-muted h-1.5 w-12 shrink-0 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  barClass,
                  unlimited && "opacity-40",
                )}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent align="start">
          <div className="text-xs">
            <div className="font-medium">
              {dim.label}（渠道级，所有用户累加）
            </div>
            <div className="mt-1 tabular-nums">
              {unlimited
                ? "未设限"
                : `${formatCapacity(dim.used, dim.limit)} · 剩 ${formatPercent(dim.remaining)}`}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function capacityColumn(
  key: CapacityDimension["key"],
  label: string,
  usableOf: (channel: RouteRuntimeChannel) => boolean,
): ColumnDef<RouteRuntimeChannel> {
  return {
    id: key,
    enableHiding: false,
    accessorFn: (row) => {
      const dim = capacityDimensions(row).find((d) => d.key === key);
      return dim ? dimensionRemaining(dim) : 1;
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label={label} />
    ),
    cell: ({ row }) => {
      const dim = capacityDimensions(row.original).find((d) => d.key === key);
      if (!dim) return <span className="text-muted-foreground">—</span>;
      return (
        <CapacityDimCell
          channel={row.original}
          dim={dim}
          usable={usableOf(row.original)}
        />
      );
    },
  };
}

function RuntimeChannelTable({
  channels,
  mode,
  infrastructureDenied,
}: {
  channels: RouteRuntimeChannel[];
  mode: RouteRuntime["mode"];
  infrastructureDenied: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const usableOf = useCallback(
    (channel: RouteRuntimeChannel) =>
      channel.breaker_store_admission === "normal" &&
      runtimeStateForChannel(channel, infrastructureDenied) === "active",
    [infrastructureDenied],
  );

  const columns = useMemo<ColumnDef<RouteRuntimeChannel>[]>(
    () => [
      {
        id: "order",
        enableHiding: false,
        // accessorFn 仅为让 tanstack 认定该列可排序（实际排序在后端 manualSorting）。
        accessorFn: (row) =>
          row.eligible ? row.current_order : Number.MAX_SAFE_INTEGER,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="顺序" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.eligible ? row.original.current_order : "—"}
          </span>
        ),
      },
      {
        id: "channel",
        header: "渠道 / Provider",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const channel = row.original;
          const state = runtimeStateForChannel(channel, infrastructureDenied);
          const providerLabel = channel.provider_name || `#${channel.provider_id}`;
          const providerStatus =
            channel.provider_status !== "enabled"
              ? ` · ${channel.provider_status}`
              : "";
          return (
            <div>
              <div className="max-w-56 truncate font-medium">
                {channel.channel_name}
              </div>
              <div className="text-muted-foreground mt-0.5 max-w-56 truncate text-xs">
                {providerLabel}
                {providerStatus}
              </div>
              {state !== "active" ? (
                <div className="mt-1">
                  <RuntimeSyncBadge state={state} />
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "eligibility",
        header: "资格",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const channel = row.original;
          return (
            <div>
              {channel.eligible ? (
                <Badge variant="outline">
                  <CheckCircle2Icon data-icon="inline-start" />
                  候选
                </Badge>
              ) : (
                <Badge variant="destructive">
                  {reasonLabel(channel.excluded_reason || "excluded")}
                </Badge>
              )}
              {channel.margin_status !== "safe" ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  毛利 {marginStatusLabel(channel.margin_status)}
                </div>
              ) : null}
            </div>
          );
        },
      },
      capacityColumn("concurrency", "并发", usableOf),
      capacityColumn("rpm", "RPM", usableOf),
      capacityColumn("rpd", "RPD", usableOf),
      capacityColumn("tpm", "TPM", usableOf),
      {
        id: "weight",
        enableHiding: false,
        accessorFn: (row) => row.final_weight,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="权重 / 分流" />
        ),
        cell: ({ row }) => {
          const channel = row.original;
          if (!usableOf(channel)) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="font-mono text-xs tabular-nums">
              <div>权重 {channel.final_weight.toFixed(4)}</div>
              <div className="text-muted-foreground mt-1">
                分流 {formatPercent(channel.selected_share_1m)}
                {channel.fallback_1m > 0 ? (
                  <span className="text-destructive">
                    {" · "}回退 {channel.fallback_1m}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="text-muted-foreground">操作</span>,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="查看详情"
            title="查看详情"
            onClick={() => setSelectedId(row.original.channel_id)}
          >
            <EyeIcon />
          </Button>
        ),
      },
    ],
    [infrastructureDenied, usableOf],
  );

  const { table } = useDataTable({
    data: channels,
    columns,
    pageCount: 1,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 100 },
      sorting: [{ id: "order", desc: false }],
    },
    // 命名空间化，避免与页面其它表/深链的 page/sort 键冲突。
    queryKeys: {
      page: "rtPage",
      perPage: "rtPerPage",
      sort: "rtSort",
      filters: "rtFilters",
    },
    getRowId: (row) => String(row.channel_id),
  });

  const selected =
    selectedId == null
      ? null
      : (channels.find((c) => c.channel_id === selectedId) ?? null);

  return (
    <>
      <DataTable table={table} emptyMessage="线路池暂无渠道" hidePagination />

      <RuntimeChannelDetailSheet
        channel={selected}
        mode={mode}
        infrastructureDenied={infrastructureDenied}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}

function RuntimeChannelDetailSheet({
  channel,
  mode,
  infrastructureDenied,
  onOpenChange,
}: {
  channel: RouteRuntimeChannel | null;
  mode: RouteRuntime["mode"];
  infrastructureDenied: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const runtimeState = channel
    ? runtimeStateForChannel(channel, infrastructureDenied)
    : "active";
  const runtimeUsable =
    channel != null &&
    channel.breaker_store_admission === "normal" &&
    runtimeState === "active";

  return (
    <Sheet open={channel != null} onOpenChange={onOpenChange}>
      <DetailSheetContent side="right" size="lg">
        {channel ? (
          <>
            <SheetHeader>
              <SheetTitle>{channel.channel_name}</SheetTitle>
              <SheetDescription className="text-xs">
                {channel.provider_name} · {channel.protocol}/
                {channel.adapter_key} · Provider #{channel.provider_id}
              </SheetDescription>
            </SheetHeader>
            <SheetMain className="pt-4">
              <RuntimeChannelDetail
                channel={channel}
                mode={mode}
                runtimeState={runtimeState}
                runtimeUsable={runtimeUsable}
              />
            </SheetMain>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}

function DetailKV({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {title}
      </div>
      {children}
    </div>
  );
}

function RuntimeChannelDetail({
  channel,
  mode,
  runtimeState,
  runtimeUsable,
}: {
  channel: RouteRuntimeChannel;
  mode: RouteRuntime["mode"];
  runtimeState: string;
  runtimeUsable: boolean;
}) {
  const dims = capacityDimensions(channel);
  return (
    <div className="grid gap-x-8 gap-y-5 py-2 sm:grid-cols-2">
      <DetailBlock title="限流明细">
        {dims.map((d) => (
          <DetailKV key={d.key} label={d.label}>
            {!runtimeUsable
              ? "—"
              : d.limit > 0
                ? `${formatCapacity(d.used, d.limit)} · 剩 ${formatPercent(d.remaining)}`
                : "未设限"}
          </DetailKV>
        ))}
      </DetailBlock>

      <DetailBlock title="熔断与拦截">
        <DetailKV label="Provider 熔断">
          {runtimeUsable ? (
            <BreakerBadge
              state={channel.provider_breaker_state}
              openRemainingMs={channel.provider_open_remaining_ms}
            />
          ) : (
            "—"
          )}
        </DetailKV>
        <DetailKV label="渠道熔断">
          {runtimeUsable ? (
            <BreakerBadge
              state={channel.channel_breaker_state}
              openRemainingMs={channel.channel_open_remaining_ms}
            />
          ) : (
            "—"
          )}
        </DetailKV>
        <DetailKV label="429 冷却">
          {!runtimeUsable
            ? "—"
            : channel.cooldown_remaining_ms > 0
              ? formatOpenRemaining(channel.cooldown_remaining_ms)
              : "无"}
        </DetailKV>
        <DetailKV label="模型权限">
          {!runtimeUsable ? (
            "—"
          ) : channel.model_permission_paused ? (
            <span className="text-destructive">
              暂停 · {permissionStateLabel(channel.model_permission_recheck_state)}
            </span>
          ) : (
            "正常"
          )}
        </DetailKV>
      </DetailBlock>

      <DetailBlock title="健康指标">
        <DetailKV label="错误率">
          {runtimeUsable
            ? `${formatPercent(channel.error_rate)} · ${channel.error_samples} 样本`
            : "—"}
        </DetailKV>
        <DetailKV label="流式 TTFT">
          {runtimeUsable && channel.ttft_samples > 0 && channel.ttft_ewma_ms != null
            ? `${formatLatencyMs(channel.ttft_ewma_ms)} · ${channel.ttft_samples} 样本`
            : "—"}
        </DetailKV>
        <DetailKV label="容量分">
          {runtimeUsable ? formatPercent(channel.capacity_score) : "—"}
        </DetailKV>
      </DetailBlock>

      <DetailBlock title="成本与权重">
        <DetailKV label="成本占售价">
          {runtimeUsable && channel.cost_ratio != null
            ? formatPercent(channel.cost_ratio)
            : "—"}
        </DetailKV>
        <DetailKV label="成本系数">
          {runtimeUsable ? (channel.cost_factor ?? 1).toFixed(4) : "—"}
        </DetailKV>
        <DetailKV label="成本权重">
          {runtimeUsable ? (channel.cost_weight ?? 0).toFixed(4) : "—"}
        </DetailKV>
        <DetailKV label="最终权重">
          {runtimeUsable ? channel.final_weight.toFixed(4) : "—"}
        </DetailKV>
        {mode === "fixed" ? (
          <div className="text-muted-foreground text-[11px]">
            固定策略不参与成本排序
          </div>
        ) : null}
      </DetailBlock>

      <DetailBlock title="分流">
        <DetailKV label="1m / 5m 次数">
          {channel.selected_1m} / {channel.selected_5m}
        </DetailKV>
        <DetailKV label="1m / 5m 占比">
          {formatPercent(channel.selected_share_1m)} /{" "}
          {formatPercent(channel.selected_share_5m)}
        </DetailKV>
        <DetailKV label="1m 回退">
          {channel.fallback_1m > 0 ? (
            <span className="text-destructive">{channel.fallback_1m}</span>
          ) : (
            "0"
          )}
        </DetailKV>
      </DetailBlock>

      <DetailBlock title="版本 / 同步">
        <DetailKV label="同步状态">
          <RuntimeSyncBadge state={runtimeState} />
        </DetailKV>
        <DetailKV label="渠道配置 r（库/运行）">
          {formatRuntimeRevision(channel.channel_config_revision)} /{" "}
          {formatRuntimeRevision(channel.runtime_channel_config_revision)}
        </DetailKV>
        <DetailKV label="准入限流 r（库/运行）">
          {formatRuntimeRevision(channel.channel_admission_limits_revision)} /{" "}
          {formatRuntimeRevision(
            channel.runtime_channel_admission_limits_revision,
          )}
        </DetailKV>
        <DetailKV label="默认限流 r（线路/渠道）">
          {formatRuntimeRevision(channel.route_rate_limits_revision)} /{" "}
          {formatRuntimeRevision(channel.channel_rate_limits_revision)}
        </DetailKV>
        <DetailKV label="控制 r（并发/熔断/均衡）">
          {formatRuntimeRevision(channel.global_concurrency_revision)} /{" "}
          {formatRuntimeRevision(channel.circuit_breaker_revision)} /{" "}
          {formatRuntimeRevision(channel.routing_balance_revision)}
        </DetailKV>
        <DetailKV label="Provider origin r（库/运行）">
          {formatRuntimeRevision(channel.origin_revision)} /{" "}
          {formatRuntimeRevision(channel.runtime_origin_revision)}
        </DetailKV>
        <DetailKV label="Provider 状态 r（库/运行）">
          {formatRuntimeRevision(channel.provider_status_revision)} /{" "}
          {formatRuntimeRevision(channel.runtime_provider_status_revision)}
        </DetailKV>
        {channel.pending_origin_revision != null ||
        channel.pending_provider_status_revision != null ? (
          <div className="text-amber-700 text-xs tabular-nums dark:text-amber-400">
            待提交 origin{" "}
            {formatRuntimeRevision(channel.pending_origin_revision)}
            {" · "}状态{" "}
            {formatRuntimeRevision(channel.pending_provider_status_revision)}
          </div>
        ) : null}
        {!channel.origin_revision_current ||
        !channel.provider_status_revision_current ? (
          <div className="text-destructive text-xs">Provider 版本不一致</div>
        ) : null}
      </DetailBlock>
    </div>
  );
}

function BreakerBadge({
  state,
  openRemainingMs,
}: {
  state: RouteRuntimeChannel["channel_breaker_state"];
  openRemainingMs: number | null;
}) {
  if (!state) return <Badge variant="outline">无样本</Badge>;
  const destructive = state === "open" || state === "half_open";
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={destructive ? "destructive" : "secondary"}>
        {state === "closed"
          ? "闭合"
          : state === "half_open"
            ? "半开"
            : "熔断中"}
      </Badge>
      {state === "open" && openRemainingMs != null ? (
        <span className="text-muted-foreground">
          剩余 {formatOpenRemaining(openRemainingMs)}
        </span>
      ) : null}
    </div>
  );
}

function RuntimeSyncBadge({ state }: { state: string }) {
  const active = state === "active";
  return (
    <Badge variant={active ? "outline" : "destructive"}>
      {RUNTIME_SYNC_LABELS[state] ?? state}
    </Badge>
  );
}

function formatOpenRemaining(ms: number): string {
  if (ms <= 0) return "0 秒";
  if (ms < 60_000) return `${Math.ceil(ms / 1_000)} 秒`;
  return `${Math.ceil(ms / 60_000)} 分钟`;
}

function RecentDecisions({
  decisions,
  total,
  loading,
  error,
  channelNames,
  onOpen,
}: {
  decisions: RoutingDecision[];
  total: number;
  loading: boolean;
  error: Error | null;
  channelNames: Map<number, string>;
  onOpen: (decision: RoutingDecision) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">最近路由决策</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            最近 {Math.min(total, DECISION_PAGE_SIZE)} / {total} 条已保存决策
          </p>
        </div>
      </div>

      {error ? (
        <ErrorBox message={error.message} />
      ) : loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : decisions.length === 0 ? (
        <SectionEmpty
          icon={ActivityIcon}
          title="暂无决策记录"
          description="普通成功请求按 5% 稳定采样，异常决策会全部保存"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>请求</TableHead>
                <TableHead>模型 / 协议</TableHead>
                <TableHead>候选</TableHead>
                <TableHead>最终渠道</TableHead>
                <TableHead>信号</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.map((decision) => (
                <TableRow key={decision.id}>
                  <TableCell className="text-xs tabular-nums">
                    {formatDateTime(decision.created_at)}
                  </TableCell>
                  <TableCell>
                    <div
                      className="max-w-40 truncate font-mono text-xs"
                      title={decision.request_id}
                    >
                      {decision.request_id}
                    </div>
                    <div className="mt-1">
                      <RequestStatusBadge status={decision.request_status} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className="max-w-48 truncate text-xs"
                      title={decision.requested_model_id}
                    >
                      {decision.requested_model_id}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {decision.protocol} · {decision.endpoint}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {decision.candidate_count} / {decision.pool_size}
                  </TableCell>
                  <TableCell className="text-xs">
                    {decision.final_channel_id != null
                      ? channelLabel(decision.final_channel_id, channelNames)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-52 flex-wrap gap-1">
                      {decision.abnormal ? (
                        <Badge variant="destructive">异常</Badge>
                      ) : (
                        <Badge variant="outline">正常采样</Badge>
                      )}
                      {decision.sticky_pinned ? (
                        <Badge variant="secondary">粘性命中</Badge>
                      ) : null}
                      {decision.fallback_chain.length > 1 ? (
                        <Badge variant="secondary">已回退</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="查看路由决策"
                      title="查看路由决策"
                      onClick={() => onOpen(decision)}
                    >
                      <EyeIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RoutingDecisionSheet({
  decision,
  channelNames,
  onOpenChange,
}: {
  decision: RoutingDecision | null;
  channelNames: Map<number, string>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={decision != null} onOpenChange={onOpenChange}>
      <DetailSheetContent side="right" size="lg">
        {decision ? (
          <>
            <SheetHeader>
              <SheetTitle>路由决策</SheetTitle>
              <SheetDescription className="font-mono text-xs break-all">
                {decision.request_id}
              </SheetDescription>
            </SheetHeader>
            <SheetMain className="flex flex-col gap-5 pt-4">
              <DecisionSummary
                decision={decision}
                channelNames={channelNames}
              />
              <DecisionSignals decision={decision} />
              <DecisionOrder decision={decision} channelNames={channelNames} />
              <DecisionScoreTable
                scores={decision.candidate_scores}
                channelNames={channelNames}
              />
            </SheetMain>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}

function DecisionSummary({
  decision,
  channelNames,
}: {
  decision: RoutingDecision;
  channelNames: Map<number, string>;
}) {
  return (
    <DecisionSection title="基本信息">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <DecisionField label="状态">
          <RequestStatusBadge status={decision.request_status} />
        </DecisionField>
        <DecisionField label="策略">
          {ROUTE_MODE_LABEL[decision.mode] ?? decision.mode}
        </DecisionField>
        <DecisionField label="算法">{decision.algorithm_version}</DecisionField>
        <DecisionField label="模型">
          {decision.requested_model_id}
        </DecisionField>
        <DecisionField label="协议 / 端点">
          {decision.protocol} · {decision.endpoint}
        </DecisionField>
        <DecisionField label="候选">
          {decision.candidate_count} / {decision.pool_size}
        </DecisionField>
        <DecisionField label="最终渠道">
          {decision.final_channel_id != null
            ? channelLabel(decision.final_channel_id, channelNames)
            : "—"}
        </DecisionField>
        <DecisionField label="粘性渠道">
          {decision.sticky_channel_id != null
            ? channelLabel(decision.sticky_channel_id, channelNames)
            : "—"}
        </DecisionField>
        <DecisionField label="记录时间">
          {formatDateTime(decision.created_at)}
        </DecisionField>
      </dl>
    </DecisionSection>
  );
}

function DecisionSignals({ decision }: { decision: RoutingDecision }) {
  const signals = [
    decision.sticky_pinned && "粘性命中",
    decision.sticky_invalid && "粘性失效",
    decision.all_capacity_zero && "全部容量耗尽",
    decision.margin_guard_triggered && "负毛利拦截",
  ].filter(Boolean) as string[];
  const reasons = decision.abnormal_reasons;

  return (
    <DecisionSection title="决策信号">
      <div className="flex flex-wrap gap-2">
        {decision.abnormal ? (
          <Badge variant="destructive">
            <AlertTriangleIcon data-icon="inline-start" />
            异常决策
          </Badge>
        ) : (
          <Badge variant="outline">
            <CheckCircle2Icon data-icon="inline-start" />
            普通采样
          </Badge>
        )}
        {signals.map((signal) => (
          <Badge key={signal} variant="secondary">
            {signal}
          </Badge>
        ))}
        {reasons.map((reason) => (
          <Badge key={reason} variant="destructive">
            {reasonLabel(reason)}
          </Badge>
        ))}
      </div>
    </DecisionSection>
  );
}

function DecisionOrder({
  decision,
  channelNames,
}: {
  decision: RoutingDecision;
  channelNames: Map<number, string>;
}) {
  return (
    <DecisionSection title="候选与回退顺序">
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground mb-1 text-xs">初始顺序</div>
          <div className="font-mono text-xs leading-6">
            {decision.selected_order.length > 0
              ? decision.selected_order
                  .map((id) => channelLabel(id, channelNames))
                  .join("  →  ")
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-xs">实际尝试链</div>
          <div className="font-mono text-xs leading-6">
            {decision.fallback_chain.length > 0
              ? decision.fallback_chain
                  .map((item) => chainItemLabel(item, channelNames))
                  .join("  →  ")
              : "无上游尝试"}
          </div>
        </div>
      </div>
    </DecisionSection>
  );
}

function DecisionScoreTable({
  scores,
  channelNames,
}: {
  scores: RoutingCandidateScore[];
  channelNames: Map<number, string>;
}) {
  return (
    <DecisionSection title={`完整线路池评分（${scores.length}）`}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>渠道</TableHead>
              <TableHead>资格</TableHead>
              <TableHead>并发 / TPM 剩余</TableHead>
              <TableHead>容量</TableHead>
              <TableHead>成本占比</TableHead>
              <TableHead>成本权重</TableHead>
              <TableHead>成本系数</TableHead>
              <TableHead>最终权重</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((score) => (
              <TableRow key={`${score.channel_id}:${score.route_index}`}>
                <TableCell>
                  <div className="max-w-48 truncate text-xs">
                    {channelLabel(score.channel_id, channelNames)}
                  </div>
                  <div className="text-muted-foreground mt-1 font-mono text-xs">
                    原池序号 {score.route_index + 1}
                  </div>
                </TableCell>
                <TableCell>
                  {score.eligible ? (
                    <Badge variant="outline">候选</Badge>
                  ) : (
                    <Badge variant="destructive">
                      {reasonLabel(score.excluded_reason || "excluded")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {formatPercent(score.concurrency_remaining)} /{" "}
                  {formatPercent(score.tpm_remaining)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {formatPercent(score.capacity_score)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {score.cost_ratio == null
                    ? "—"
                    : formatPercent(score.cost_ratio)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {(score.cost_weight ?? 0).toFixed(4)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {(score.cost_factor ?? 1).toFixed(4)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {score.final_weight.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DecisionSection>
  );
}

function DecisionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function DecisionField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
