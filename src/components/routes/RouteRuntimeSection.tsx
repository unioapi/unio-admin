import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
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
    RUNTIME_SYNC_LABELS[reason] ??
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

function isObjectiveScore(value: {
  algorithm_version?: string;
  final_score?: number;
}): boolean {
  return (
    value.algorithm_version === "objective_v1" || value.final_score != null
  );
}

function formatObjectiveScore(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatWeightedScore(
  score: number | null | undefined,
  weightPct: number | null | undefined,
): string {
  if (score == null || !Number.isFinite(score)) return "—";
  const weight = weightPct ?? 0;
  return `${score.toFixed(2)} × ${weight}% = ${((score * weight) / 100).toFixed(2)}`;
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

function breakerStateLabel(
  state: RouteRuntimeChannel["channel_breaker_state"],
): string {
  if (!state) return "无样本";
  if (state === "closed") return "闭合";
  if (state === "half_open") return "半开";
  return "熔断中";
}

function ColumnHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label}列说明`}
            className="text-muted-foreground/60 hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center"
          >
            <CircleHelpIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-sm leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StaticColumnHeader({
  label,
  hint,
}: {
  label: string;
  hint: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <ColumnHelp label={label}>{hint}</ColumnHelp>
    </div>
  );
}

function SortableColumnHeader<TValue>({
  column,
  label,
  hint,
}: {
  column: Column<RouteRuntimeChannel, TValue>;
  label: string;
  hint: ReactNode;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <DataTableColumnHeader column={column} label={label} />
      <ColumnHelp label={label}>{hint}</ColumnHelp>
    </div>
  );
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
                <SelectGroup>
                  {models.map((model) => (
                    <SelectItem key={model.model_id} value={model.model_id}>
                      {model.display_name || model.model_id}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
                <SelectGroup>
                  <SelectItem value="all">全部协议</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectGroup>
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
          <SummaryItem
            label="并发"
            value={formatCompact(usage.concurrency)}
            hint="该线路全部用户当前仍在 Gateway 请求生命周期内的入口请求数，覆盖路由、候选等待、上游调用、结算和响应写出。"
          />
          <SummaryItem
            label="RPM"
            value={formatCompact(usage.rpm)}
            hint="该线路全部用户在当前 UTC 自然分钟内通过入口准入的请求数。一次客户请求只计一次，fallback 不重复。"
          />
          <SummaryItem
            label="RPD"
            value={formatCompact(usage.rpd)}
            hint="该线路全部用户在当前 UTC 自然日内通过入口准入的请求数。它记录 Route 入口事实，不要求等于各 Channel RPD 求和。"
          />
          <SummaryItem
            label="TPM"
            value={formatCompact(usage.tpm)}
            hint="该线路全部用户在当前 UTC 自然分钟内的请求级 Token 用量，包含已完成实际值和在途请求的完整预算；明确未访问上游时释放预算。"
          />
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  danger = false,
  hint,
}: {
  label: string;
  value: string;
  danger?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="border-b px-3 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <span>{label}</span>
        {hint ? <ColumnHelp label={`线路${label}`}>{hint}</ColumnHelp> : null}
      </div>
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
  capacityUsed?: number;
  factsUnavailable?: boolean;
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
      limit: channel.global_rpd_limit ?? 0,
      remaining: channel.global_rpd_remaining ?? null,
      capacityUsed: channel.global_rpd_used,
      factsUnavailable:
        channel.global_rpd_used == null || channel.global_rpd_limit == null,
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

// CapacityDimCell：加高 Progress，左右文字叠在条内两端。
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
  if (channel.capacity_read_failed || dim.factsUnavailable) {
    return <Badge variant="destructive">失败</Badge>;
  }

  const unlimited = dim.limit <= 0;
  const capacityUsed = dim.capacityUsed ?? dim.used;
  const routeRPD = dim.key === "rpd";
  const remaining = unlimited ? 1 : dimensionRemaining(dim);
  const usagePct = unlimited
    ? 0
    : Math.min(
        100,
        Math.max(
          0,
          Math.round((capacityUsed / Math.max(dim.limit, 1)) * 100),
        ),
      );
  const tone = unlimited
    ? "ok"
    : remaining >= 0.5
      ? "ok"
      : remaining >= 0.2
        ? "warn"
        : "danger";
  const indicatorTone =
    tone === "ok"
      ? "[&_[data-slot=progress-indicator]]:bg-emerald-500/35"
      : tone === "warn"
        ? "[&_[data-slot=progress-indicator]]:bg-amber-500/45"
        : "[&_[data-slot=progress-indicator]]:bg-red-500/50";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative w-[9.75rem] cursor-help text-left"
            aria-label={
              routeRPD
                ? unlimited
                  ? `RPD 当前线路 ${formatCompact(dim.used)} 次，渠道全局不限`
                  : `RPD 当前线路 ${formatCompact(dim.used)} 次，渠道全局 ${formatCapacity(capacityUsed, dim.limit)}，占用 ${usagePct}%`
                : unlimited
                ? `${dim.label} 不限`
                : `${dim.label} ${formatCapacity(dim.used, dim.limit)}，占用 ${usagePct}%`
            }
          >
            <Progress
              value={usagePct}
              className={cn("h-6", indicatorTone, unlimited && "opacity-50")}
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[11px] tabular-nums tracking-tight">
              <span
                className={cn(
                  "truncate",
                  tone === "ok" && "text-foreground/85",
                  tone === "warn" && "text-amber-800 dark:text-amber-300",
                  tone === "danger" &&
                    "font-medium text-red-800 dark:text-red-300",
                )}
              >
                {routeRPD
                  ? `本线路 ${formatCompact(dim.used)}`
                  : unlimited
                    ? "不限"
                    : formatCapacity(dim.used, dim.limit)}
              </span>
              <span className="text-muted-foreground shrink-0">
                {routeRPD
                  ? unlimited
                    ? "全局不限"
                    : `全局 ${usagePct}%`
                  : unlimited
                    ? "—"
                    : `${usagePct}%`}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent align="start">
          <div className="text-xs">
            <div className="font-medium">
              {routeRPD
                ? "RPD（当前线路 Channel attempt）"
                : `${dim.label}（渠道级，所有线路累加）`}
            </div>
            {routeRPD ? (
              <div className="mt-1 space-y-1 tabular-nums">
                <div>当前线路归因：{formatCompact(dim.used)} 次</div>
                <div>
                  渠道全局容量：
                  {unlimited
                    ? `${formatCompact(capacityUsed)} / 不限`
                    : `${formatCapacity(capacityUsed, dim.limit)} · 占用 ${usagePct}% · 剩 ${formatPercent(dim.remaining)}`}
                </div>
                <div className="text-background/70">
                  Route 入口与 Channel attempt 分别记录，不要求求和相等。
                </div>
              </div>
            ) : (
              <div className="mt-1 tabular-nums">
                {unlimited
                  ? "未设限"
                  : `${formatCapacity(dim.used, dim.limit)} · 占用 ${usagePct}% · 剩 ${formatPercent(dim.remaining)}`}
              </div>
            )}
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
      <SortableColumnHeader
        column={column}
        label={label}
        hint={capacityColumnHint(key)}
      />
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

function capacityColumnHint(key: CapacityDimension["key"]): string {
  const hints: Record<string, string> = {
    concurrency:
      "该 Channel 当前持有 AttemptPermit 的上游 attempt 数。按 Channel 全局统计，多条 Route 共用同一份并发容量。",
    rpm: "该 Channel 当前 UTC 自然分钟内已有上游交互证据或结果不确定的 attempt 数。明确未写出请求时释放；按 Channel 全局统计。",
    rpd: "主值是当前 Route 归因到该 Channel 的 attempt 数；悬浮单元格可查看 Channel 跨 Route 的全局 RPD 容量。Route 入口与 Channel attempt 分别记录，不要求求和相等。",
    tpm: "该 Channel 当前 UTC 自然分钟内跨 Route 的 Token 用量与在途完整预算。结束后按上游 usage、本地输出或输入保底值校正。",
  };
  return hints[key] ?? "渠道级限流使用量与上限。";
}

function TooltipKV({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-background/70">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}

function ChannelCell({ channel }: { channel: RouteRuntimeChannel }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`查看渠道 ${channel.channel_name} 详情`}
            className="max-w-56 cursor-help text-left"
          >
            <span className="block truncate font-medium">
              {channel.channel_name}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="w-80 max-w-[min(20rem,calc(100vw-2rem))] p-3"
        >
          <div className="space-y-2 text-xs">
            <div className="font-medium">{channel.channel_name}</div>
            <TooltipKV label="渠道 ID">#{channel.channel_id}</TooltipKV>
            <TooltipKV label="Provider">
              {channel.provider_name || `#${channel.provider_id}`} (#
              {channel.provider_id})
            </TooltipKV>
            <TooltipKV label="状态">
              渠道 {channel.channel_status} · Provider {channel.provider_status}
            </TooltipKV>
            <TooltipKV label="协议 / Adapter">
              {channel.protocol} / {channel.adapter_key}
            </TooltipKV>
            <TooltipKV label="Priority">{channel.priority}</TooltipKV>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EligibilityCell({ channel }: { channel: RouteRuntimeChannel }) {
  const reason = channel.excluded_reason || "excluded";
  const eligible = channel.eligible;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="cursor-help text-left">
            {eligible ? (
              <Badge variant="outline">
                <CheckCircle2Icon data-icon="inline-start" />
                候选
              </Badge>
            ) : (
              <Badge variant="destructive">{reasonLabel(reason)}</Badge>
            )}
            {channel.margin_status !== "safe" ? (
              <span className="text-muted-foreground mt-1 block text-xs">
                毛利 {marginStatusLabel(channel.margin_status)}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-sm p-3">
          <div className="space-y-2 text-xs leading-relaxed">
            <div className="font-medium">
              {eligible
                ? "已进入本次候选池"
                : `未进入候选池：${reasonLabel(reason)}`}
            </div>
            <div>
              资格由线路、渠道和 Provider
              状态，以及凭据、地址、协议、模型绑定、价格、熔断、冷却、权限与运行态版本共同决定。
            </div>
            <TooltipKV label="毛利检查">
              {marginStatusLabel(channel.margin_status)}
            </TooltipKV>
            <TooltipKV label="Provider 熔断">
              {breakerStateLabel(channel.provider_breaker_state)}
            </TooltipKV>
            <TooltipKV label="渠道熔断">
              {breakerStateLabel(channel.channel_breaker_state)}
            </TooltipKV>
            <TooltipKV label="429 冷却">
              {channel.cooldown_remaining_ms > 0
                ? `剩 ${formatOpenRemaining(channel.cooldown_remaining_ms)}`
                : "无"}
            </TooltipKV>
            <TooltipKV label="模型权限">
              {channel.model_permission_paused
                ? `暂停 · ${permissionStateLabel(channel.model_permission_recheck_state)}`
                : "正常"}
            </TooltipKV>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreCell({
  channel,
  mode,
  usable,
}: {
  channel: RouteRuntimeChannel;
  mode: RouteRuntime["mode"];
  usable: boolean;
}) {
  if (!usable || !channel.eligible) {
    return <span className="text-muted-foreground">—</span>;
  }
  const objective = isObjectiveScore(channel);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`查看得分详情 ${
              objective
                ? formatObjectiveScore(channel.final_score)
                : channel.final_weight.toFixed(4)
            }`}
            className="cursor-help text-left font-mono text-xs tabular-nums"
          >
            {objective
              ? formatObjectiveScore(channel.final_score)
              : channel.final_weight.toFixed(4)}
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="w-96 max-w-[min(24rem,calc(100vw-2rem))] p-3"
        >
          {objective ? (
            <div className="space-y-2 text-xs">
              <div className="font-medium">
                客观评分 · {channel.algorithm_version}
              </div>
              <div className="text-background/70">
                总分 = 经济×{channel.economic_weight_pct ?? 0}% + 健康×
                {channel.health_weight_pct ?? 0}% + 容量×
                {channel.capacity_weight_pct ?? 0}% + Priority×
                {channel.priority_weight_pct ?? 0}%
              </div>
              <TooltipKV label="经济贡献">
                {formatWeightedScore(
                  channel.economic_score,
                  channel.economic_weight_pct,
                )}
              </TooltipKV>
              <TooltipKV label="健康贡献">
                {formatWeightedScore(
                  channel.health_score,
                  channel.health_weight_pct,
                )}
              </TooltipKV>
              <TooltipKV label="容量贡献">
                {formatWeightedScore(
                  channel.capacity_score,
                  channel.capacity_weight_pct,
                )}
              </TooltipKV>
              <TooltipKV label="Priority 贡献">
                {formatWeightedScore(
                  channel.priority_score,
                  channel.priority_weight_pct,
                )}
              </TooltipKV>
              <TooltipKV label="最终得分">
                {formatObjectiveScore(channel.final_score)}
              </TooltipKV>
              <TooltipKV label="成本占售价">
                {channel.cost_ratio != null
                  ? formatPercent(channel.cost_ratio)
                  : "—"}
              </TooltipKV>
              <TooltipKV label="错误率 / 样本">
                {formatPercent(channel.error_rate)} / {channel.error_samples}
              </TooltipKV>
              <TooltipKV label="并发 / TPM 剩余">
                {formatPercent(channel.concurrency_remaining)} /{" "}
                {formatPercent(channel.tpm_remaining)}
              </TooltipKV>
              <TooltipKV label="TTFT / 样本">
                {channel.ttft_ewma_ms != null
                  ? formatLatencyMs(channel.ttft_ewma_ms)
                  : "—"}{" "}
                / {channel.ttft_samples}
              </TooltipKV>
              <TooltipKV label="Priority 原值">{channel.priority}</TooltipKV>
              {mode === "fixed" ? (
                <div className="text-background/70">
                  固定线路展示评分事实，但不按分数重排。
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="font-medium">兼容权重评分</div>
              <TooltipKV label="容量分">
                {formatPercent(channel.capacity_score)}
              </TooltipKV>
              <TooltipKV label="成本占售价">
                {channel.cost_ratio != null
                  ? formatPercent(channel.cost_ratio)
                  : "—"}
              </TooltipKV>
              <TooltipKV label="成本系数">
                {(channel.cost_factor ?? 1).toFixed(4)}
              </TooltipKV>
              <TooltipKV label="成本权重">
                {(channel.cost_weight ?? 0).toFixed(4)}
              </TooltipKV>
              <TooltipKV label="最终权重">
                {channel.final_weight.toFixed(4)}
              </TooltipKV>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TrafficCell({ channel }: { channel: RouteRuntimeChannel }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`查看分流详情 ${formatPercent(channel.selected_share_1m)}`}
            className="cursor-help text-left text-xs tabular-nums"
          >
            <span className="block font-medium">
              {formatPercent(channel.selected_share_1m)}
            </span>
            <span className="text-muted-foreground mt-0.5 block">
              {channel.selected_1m} 次 / 1m
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="w-72 max-w-[min(18rem,calc(100vw-2rem))] p-3"
        >
          <div className="space-y-2 text-xs">
            <div className="font-medium">当前线路内的最终命中分布</div>
            <TooltipKV label="最近 1 分钟">
              {channel.selected_1m} 次 ·{" "}
              {formatPercent(channel.selected_share_1m)}
            </TooltipKV>
            <TooltipKV label="最近 5 分钟">
              {channel.selected_5m} 次 ·{" "}
              {formatPercent(channel.selected_share_5m)}
            </TooltipKV>
            <TooltipKV label="最近 1 分钟回退">{channel.fallback_1m}</TooltipKV>
            <div className="text-background/70">
              分流按当前线路统计；它不是配置权重，也不与其他线路共享。
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SyncCell({
  channel,
  state,
}: {
  channel: RouteRuntimeChannel;
  state: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`查看同步详情 ${RUNTIME_SYNC_LABELS[state] ?? state}`}
            className="cursor-help text-left"
          >
            <RuntimeSyncBadge state={state} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="w-[26rem] max-w-[min(26rem,calc(100vw-2rem))] p-3"
        >
          <div className="space-y-2 text-xs">
            <div className="font-medium">版本与同步状态</div>
            <TooltipKV label="同步状态">
              {RUNTIME_SYNC_LABELS[state] ?? state}
            </TooltipKV>
            <TooltipKV label="渠道配置（库 / 运行）">
              {formatRuntimeRevision(channel.channel_config_revision)} /{" "}
              {formatRuntimeRevision(channel.runtime_channel_config_revision)}
            </TooltipKV>
            <TooltipKV label="准入限流（库 / 运行）">
              {formatRuntimeRevision(channel.channel_admission_limits_revision)}{" "}
              /{" "}
              {formatRuntimeRevision(
                channel.runtime_channel_admission_limits_revision,
              )}
            </TooltipKV>
            <TooltipKV label="Provider origin（库 / 运行）">
              {formatRuntimeRevision(channel.origin_revision)} /{" "}
              {formatRuntimeRevision(channel.runtime_origin_revision)}
            </TooltipKV>
            <TooltipKV label="Provider 状态（库 / 运行）">
              {formatRuntimeRevision(channel.provider_status_revision)} /{" "}
              {formatRuntimeRevision(channel.runtime_provider_status_revision)}
            </TooltipKV>
            <TooltipKV label="默认限流（线路 / 渠道）">
              {formatRuntimeRevision(channel.route_rate_limits_revision)} /{" "}
              {formatRuntimeRevision(channel.channel_rate_limits_revision)}
            </TooltipKV>
            <TooltipKV label="控制（并发 / 熔断 / 均衡）">
              {formatRuntimeRevision(channel.global_concurrency_revision)} /{" "}
              {formatRuntimeRevision(channel.circuit_breaker_revision)} /{" "}
              {formatRuntimeRevision(channel.routing_balance_revision)}
            </TooltipKV>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TTFTCell({
  channel,
  usable,
}: {
  channel: RouteRuntimeChannel;
  usable: boolean;
}) {
  const hasSample =
    usable && channel.ttft_samples > 0 && channel.ttft_ewma_ms != null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`查看 TTFT 详情 ${
              hasSample ? formatLatencyMs(channel.ttft_ewma_ms) : "无样本"
            }`}
            className="cursor-help text-left text-xs tabular-nums"
          >
            {hasSample ? (
              <>
                <span className="block font-medium">
                  {formatLatencyMs(channel.ttft_ewma_ms)}
                </span>
                <span className="text-muted-foreground mt-0.5 block">
                  {channel.ttft_samples} 样本
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">无样本</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-sm p-3">
          <div className="space-y-2 text-xs leading-relaxed">
            <div className="font-medium">流式首字时间（TTFT）</div>
            <div>
              这里是首个响应 Token
              到达时间的指数移动平均，只采集流式请求；不是完整响应耗时，也不是简单算术平均。
            </div>
            <TooltipKV label="当前均值">
              {hasSample ? formatLatencyMs(channel.ttft_ewma_ms) : "—"}
            </TooltipKV>
            <TooltipKV label="样本数">{channel.ttft_samples}</TooltipKV>
            <TooltipKV label="样本来源">仅流式请求</TooltipKV>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
          <SortableColumnHeader
            column={column}
            label="顺序"
            hint="当前请求计划中的候选顺序。被排除的渠道不参与排序；固定线路按配置顺序，负载均衡线路按当前得分排序。"
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.eligible ? row.original.current_order : "—"}
          </span>
        ),
      },
      {
        id: "channel",
        header: () => (
          <StaticColumnHeader
            label="渠道"
            hint="渠道是实际调用上游的配置实体。悬浮渠道名称可查看 Provider、协议、Adapter、状态、ID 和 Priority。"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <ChannelCell channel={row.original} />,
      },
      {
        id: "eligibility",
        header: () => (
          <StaticColumnHeader
            label="资格"
            hint={
              <div className="space-y-1.5">
                <div>候选：满足所有硬条件，可进入当前请求的选路计划。</div>
                <div>
                  排除原因包括状态停用/归档、凭据或地址缺失、协议或模型不匹配、价格/毛利不合格、熔断/冷却、权限暂停及版本不同步。
                </div>
              </div>
            }
          />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <EligibilityCell channel={row.original} />,
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
          <SortableColumnHeader
            column={column}
            label="得分"
            hint="负载均衡的当前客观总分。由经济、健康、容量和 Priority 四项按配置权重加权；悬浮数值可查看公式、分项、权重和输入事实。"
          />
        ),
        cell: ({ row }) => (
          <ScoreCell
            channel={row.original}
            mode={mode}
            usable={usableOf(row.original)}
          />
        ),
      },
      {
        id: "traffic",
        header: () => (
          <StaticColumnHeader
            label="分流"
            hint="当前线路内各渠道最终命中的实际分布。主值为最近 1 分钟占比；悬浮可查看 1m/5m 次数、占比及回退次数。"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <TrafficCell channel={row.original} />,
      },
      {
        id: "sync",
        header: () => (
          <StaticColumnHeader
            label="同步"
            hint="PostgreSQL 配置与 Redis 运行态是否一致。悬浮状态可核对渠道、Provider、限流、并发、熔断和均衡控制版本。"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <SyncCell
            channel={row.original}
            state={runtimeStateForChannel(row.original, infrastructureDenied)}
          />
        ),
      },
      {
        id: "ttft",
        header: () => (
          <StaticColumnHeader
            label="TTFT"
            hint="流式请求从发起上游调用到收到首个 Token 的指数移动平均。它只使用流式样本，不代表完整响应耗时。"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <TTFTCell channel={row.original} usable={usableOf(row.original)} />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => (
          <StaticColumnHeader
            label="操作"
            hint="打开渠道负载均衡完整详情，包括限流、熔断与拦截、健康、评分、分流和版本同步信息。"
          />
        ),
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
    [infrastructureDenied, mode, usableOf],
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

function DetailKV({ label, children }: { label: string; children: ReactNode }) {
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
              暂停 ·{" "}
              {permissionStateLabel(channel.model_permission_recheck_state)}
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
          {runtimeUsable &&
          channel.ttft_samples > 0 &&
          channel.ttft_ewma_ms != null
            ? `${formatLatencyMs(channel.ttft_ewma_ms)} · ${channel.ttft_samples} 样本`
            : "—"}
        </DetailKV>
        <DetailKV label="容量分">
          {runtimeUsable
            ? isObjectiveScore(channel)
              ? formatObjectiveScore(channel.capacity_score)
              : formatPercent(channel.capacity_score)
            : "—"}
        </DetailKV>
      </DetailBlock>

      <DetailBlock
        title={isObjectiveScore(channel) ? "客观评分" : "成本与权重"}
      >
        {isObjectiveScore(channel) ? (
          <>
            <DetailKV label="经济 / 健康">
              {runtimeUsable
                ? `${formatObjectiveScore(channel.economic_score)} / ${formatObjectiveScore(channel.health_score)}`
                : "—"}
            </DetailKV>
            <DetailKV label="容量 / Priority">
              {runtimeUsable
                ? `${formatObjectiveScore(channel.capacity_score)} / ${formatObjectiveScore(channel.priority_score)}`
                : "—"}
            </DetailKV>
            <DetailKV label="权重（经/健/容/P）">
              {runtimeUsable
                ? `${channel.economic_weight_pct ?? 0}% / ${channel.health_weight_pct ?? 0}% / ${channel.capacity_weight_pct ?? 0}% / ${channel.priority_weight_pct ?? 0}%`
                : "—"}
            </DetailKV>
            <DetailKV label="最终得分">
              {runtimeUsable ? formatObjectiveScore(channel.final_score) : "—"}
            </DetailKV>
          </>
        ) : (
          <>
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
          </>
        )}
        {mode === "fixed" ? (
          <div className="text-muted-foreground text-[11px]">
            固定策略展示评分事实，但不按分数重排
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
  const objective = scores.some(isObjectiveScore);
  return (
    <DecisionSection title={`完整线路池评分（${scores.length}）`}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>渠道</TableHead>
              <TableHead>资格</TableHead>
              <TableHead>并发 / TPM 剩余</TableHead>
              {objective ? (
                <>
                  <TableHead>经济</TableHead>
                  <TableHead>健康</TableHead>
                  <TableHead>容量</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>总分</TableHead>
                </>
              ) : (
                <>
                  <TableHead>容量</TableHead>
                  <TableHead>成本占比</TableHead>
                  <TableHead>成本权重</TableHead>
                  <TableHead>成本系数</TableHead>
                  <TableHead>最终权重</TableHead>
                </>
              )}
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
                {objective ? (
                  <>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatObjectiveScore(score.economic_score)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatObjectiveScore(score.health_score)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatObjectiveScore(score.capacity_score)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatObjectiveScore(score.priority_score)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatObjectiveScore(score.final_score)}
                    </TableCell>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
