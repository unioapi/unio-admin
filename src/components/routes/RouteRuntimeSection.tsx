import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleXIcon,
  EyeIcon,
  InfoIcon,
} from "lucide-react";
import {
  getRouteOpsReachableModels,
  getRouteRuntime,
  type RouteRuntime,
  type RouteRuntimeChannel,
} from "@/lib/api/routesOps";
import {
  formatDateTime,
  formatInt,
  formatLatencyMs,
  formatPercent,
  trimDecimal,
} from "@/lib/format";
import { RequestsList } from "@/components/requests/RequestsList";
import { RefreshControl } from "@/components/common/RefreshControl";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import {
  ChannelColumnTip,
  ConcurrencyColumnTip,
  ConcurrencyTip,
  DistributionColumnTip,
  DistributionTip,
  ELIGIBILITY_LABELS,
  EligibilityColumnTip,
  EligibilityTip,
  formatPercentPoints,
  formatScore,
  reasonLabel,
  RUNTIME_LABELS,
  RuntimeColumnTip,
  ScoreColumnTip,
  ScoreTip,
  TrafficColumnTip,
  TrafficTip,
  TTFTColumnTip,
  TTFTTip,
} from "@/components/routes/RouteCandidateTips";
import { useRefreshSettings } from "@/hooks/useRefreshSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SampleDimension = "any" | "ttft" | "error";

export function RouteDataSourceSubtitle({ routeId }: { routeId: number }) {
  const models = useQuery({
    queryKey: ["route", routeId, "ops-reachable-models"],
    queryFn: () => getRouteOpsReachableModels(routeId),
  });
  const modelId = models.data?.[0]?.model_id ?? "";
  const runtime = useQuery({
    queryKey: ["route", routeId, "ops-runtime", modelId, "all", "order"],
    queryFn: ({ signal }) =>
      getRouteRuntime(routeId, { model_id: modelId, sort: "order" }, signal),
    enabled: modelId !== "",
  });

  if (models.isPending || runtime.isPending) {
    return <span className="text-muted-foreground">数据源 · 加载中</span>;
  }
  if (models.isError || runtime.isError) {
    return <span className="text-destructive">数据源 · 不可用</span>;
  }
  if (!modelId || !runtime.data) {
    return <span className="text-muted-foreground">数据源 · 暂无可达模型</span>;
  }
  const source = runtime.data.source_status;
  const label = source.stale
    ? "观测已过期"
    : RUNTIME_LABELS[source.state] ?? source.state;
  return (
    <span className={source.state === "active" && !source.stale ? undefined : "text-destructive"}>
      数据源 · {label} · {formatDateTime(source.observed_at)}
    </span>
  );
}

export function RouteRuntimeSection({ routeId }: { routeId: number }) {
  const [modelId, setModelId] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState<RouteRuntimeChannel | null>(null);
  const [sampleChannelId, setSampleChannelId] = useState("all");
  const [sampleDimension, setSampleDimension] = useState<SampleDimension>("any");
  const {
    autoRefresh,
    intervalSec,
    setAutoRefresh,
    setIntervalSec,
  } = useRefreshSettings(`route:${routeId}:runtime`, {
    autoRefresh: true,
    intervalSec: 10,
  });

  const modelsQuery = useQuery({
    queryKey: ["route", routeId, "ops-reachable-models"],
    queryFn: () => getRouteOpsReachableModels(routeId),
    staleTime: 60_000,
  });
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);

  useEffect(() => {
    if (models.length === 0) return;
    if (!models.some((model) => model.model_id === modelId)) {
      setModelId(models[0].model_id);
    }
  }, [modelId, models]);

  const runtimeQuery = useQuery({
    queryKey: ["route", routeId, "ops-runtime", modelId, protocol, "order"],
    queryFn: ({ signal }) =>
      getRouteRuntime(routeId, {
        model_id: modelId,
        protocol: protocol === "all" ? undefined : (protocol as "openai" | "anthropic"),
        sort: "order",
      }, signal),
    enabled: modelId !== "",
    // 用 react-query 的间隔刷新：上一轮未完成时不会叠新请求，避免 setInterval 并发堆积把标签页打崩。
    refetchInterval: autoRefresh ? intervalSec * 1000 : false,
    refetchIntervalInBackground: false,
  });

  const refetchModels = modelsQuery.refetch;
  const refetchRuntime = runtimeQuery.refetch;
  const refreshRuntime = useCallback(() => {
    void refetchModels();
    if (modelId !== "") {
      void refetchRuntime();
    }
  }, [modelId, refetchModels, refetchRuntime]);

  if (modelsQuery.isPending) return <RuntimeSkeleton />;
  if (modelsQuery.isError) {
    return <RuntimeError message={modelsQuery.error.message} />;
  }
  if (models.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ActivityIcon />
          </EmptyMedia>
          <EmptyTitle>没有可达模型</EmptyTitle>
          <EmptyDescription>先完成模型绑定、售价和渠道成本配置。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const runtime = runtimeQuery.data;
  const fixedChannelId = sampleChannelId === "all" ? undefined : Number(sampleChannelId);
  const sampleWindow = runtime
    ? {
        from: runtime.sample_window.started_at ?? undefined,
        to: runtime.sample_window.ended_at ?? undefined,
      }
    : undefined;

  return (
    <>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4" aria-labelledby="route-candidates-title">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <h2 id="route-candidates-title" className="text-base font-medium">
                候选顺序表
              </h2>
              <p className="text-muted-foreground text-sm">
                按当前模型和协议展示真实候选资格、运行态与五项评分。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full sm:w-64" aria-label="选择模型">
                  <SelectValue placeholder="选择模型" />
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
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger className="w-full sm:w-40" aria-label="选择协议">
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
              <RefreshControl
                autoRefresh={autoRefresh}
                intervalSec={intervalSec}
                onAutoRefreshChange={setAutoRefresh}
                onIntervalChange={setIntervalSec}
                onRefresh={refreshRuntime}
                spinning={autoRefresh || modelsQuery.isFetching || runtimeQuery.isFetching}
                refreshLabel="刷新实时路由"
              />
            </div>
          </div>

          {runtimeQuery.isError ? (
            <RuntimeError message={runtimeQuery.error.message} />
          ) : runtimeQuery.isPending || !runtime ? (
            <RuntimeSkeleton />
          ) : (
            <>
              <RuntimeNotice runtime={runtime} />
              <RouteUsageStrip runtime={runtime} />
              <CandidateTable
                runtime={runtime}
                onInspect={setSelectedChannel}
              />
            </>
          )}
        </section>

        {runtime ? (
          <section className="flex flex-col gap-4" aria-labelledby="route-samples-title">
            <div>
              <h2 id="route-samples-title" className="text-base font-medium">
                最近 30 分钟评分样本
              </h2>
              <p className="text-muted-foreground text-sm">
                复用请求记录列表；打开请求即可核对对应 attempt 和路由过程。
              </p>
            </div>
            <RequestsList
              fixedRouteId={routeId}
              fixedChannelId={fixedChannelId}
              scoringDimension={sampleDimension}
              sampleWindow={sampleWindow}
              storageKey={`route:${routeId}:scoring-samples`}
              showRangeFilter={false}
              showRefreshControl={false}
              defaultPageSize={10}
              toolbarLeading={
                <>
                  <Select value={sampleChannelId} onValueChange={setSampleChannelId}>
                    <SelectTrigger className="w-full sm:w-56" aria-label="筛选样本渠道">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">全部渠道</SelectItem>
                        {runtime.channels.map((channel) => (
                          <SelectItem key={channel.channel_id} value={String(channel.channel_id)}>
                            {channel.channel_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sampleDimension}
                    onValueChange={(value) => setSampleDimension(value as SampleDimension)}
                  >
                    <SelectTrigger className="w-full sm:w-44" aria-label="筛选评分维度">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="any">全部评分样本</SelectItem>
                        <SelectItem value="ttft">TTFT 样本</SelectItem>
                        <SelectItem value="error">错误率样本</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </section>
        ) : null}
      </div>

      <ChannelDetailSheet
        channel={selectedChannel}
        open={selectedChannel != null}
        onOpenChange={(open) => {
          if (!open) setSelectedChannel(null);
        }}
      />
    </>
  );
}

function RuntimeNotice({ runtime }: { runtime: RouteRuntime }) {
  const source = runtime.source_status;
  if (source.state === "active" && !source.stale && !runtime.route_summary.all_capacity_full) {
    return null;
  }
  const capacityMessage = runtime.route_summary.all_capacity_full
    ? "当前所有合格渠道均已满载，请求会进入极短的有界等待后重扫。"
    : null;
  const admissionMessage = source.breaker_store_admission === "denied"
    ? "共享运行态不可用，当前准入已拒绝。"
    : null;
  const title = source.state === "store_unavailable" && source.breaker_store_admission === "denied"
    ? "基础设施故障，准入已拒绝"
    : source.stale
      ? "运行态观测已过期"
      : RUNTIME_LABELS[source.state] ?? source.state;
  return (
    <Alert variant={source.state === "active" && !source.stale ? "default" : "destructive"}>
      <CircleAlertIcon />
      <AlertTitle>
        {title}
      </AlertTitle>
      <AlertDescription>
        {capacityMessage ?? admissionMessage ?? "当前数据源未处于完全同步状态，候选表不应作为实时准入事实。"}
      </AlertDescription>
    </Alert>
  );
}

/**
 * 线路级入口观测（所有用户桶合计，只读）。
 * 限流上限配在线路上，但准入按 (线路, 用户) 分桶——这里的合计不会直接 429。
 * TPM 只有观测值：Unio 不限制 token 吞吐，不显示上限也没有剩余量可算。
 */
function RouteUsageStrip({ runtime }: { runtime: RouteRuntime }) {
  const usage = runtime.route_summary.usage;
  if (!usage) return null;
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs font-medium">线路入口观测</span>
        <HoverCard openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>
            <InfoIcon
              aria-label="线路入口观测说明"
              className="text-muted-foreground size-3.5 cursor-default"
            />
          </HoverCardTrigger>
          <TipHoverCardContent align="start" className="w-72">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              该线路上全部用户的合计用量，只做观测。限流上限配在线路上，但按
              (线路, 用户) 分桶执行——每个用户各自撞到并发 / RPM / RPD 才
              429；这里的合计本身不会触发拦截。TPM 是当前自然分钟观测到的输入 +
              输出 token，没有上限也不参与拦截。
            </p>
          </TipHoverCardContent>
        </HoverCard>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
        <DetailValue label="在途并发">{formatInt(usage.concurrency)}</DetailValue>
        <DetailValue label="RPM">{formatInt(usage.rpm)}</DetailValue>
        <DetailValue label="RPD">{formatInt(usage.rpd)}</DetailValue>
        <DetailValue label="TPM（观测）">{formatInt(usage.tpm)}</DetailValue>
        <DetailValue label="活跃用户">{formatInt(usage.active_users)}</DetailValue>
      </dl>
    </div>
  );
}

function CandidateTable({
  runtime,
  onInspect,
}: {
  runtime: RouteRuntime;
  onInspect: (channel: RouteRuntimeChannel) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="min-w-[1260px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">顺序</TableHead>
            <TableHead className="w-56">
              <ColumnLabel label="渠道" tip={<ChannelColumnTip />} />
            </TableHead>
            <TableHead className="w-36">
              <ColumnLabel label="资格" tip={<EligibilityColumnTip />} />
            </TableHead>
            <TableHead className="w-32">
              <ColumnLabel label="运行态" tip={<RuntimeColumnTip />} />
            </TableHead>
            <TableHead className="w-36">
              <ColumnLabel label="并发" tip={<ConcurrencyColumnTip />} />
            </TableHead>
            <TableHead className="w-28">
              <ColumnLabel label="TTFT" tip={<TTFTColumnTip />} />
            </TableHead>
            <TableHead className="w-28">
              <ColumnLabel label="流量" tip={<TrafficColumnTip />} />
            </TableHead>
            <TableHead className="w-28">
              <ColumnLabel label="得分" tip={<ScoreColumnTip />} />
            </TableHead>
            <TableHead className="w-28">
              <ColumnLabel label="分流" tip={<DistributionColumnTip />} />
            </TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runtime.channels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                当前筛选没有渠道
              </TableCell>
            </TableRow>
          ) : (
            runtime.channels.map((channel) => (
              <TableRow key={channel.channel_id}>
                <TableCell className="font-medium tabular-nums">{channel.order}</TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{channel.channel_name}</div>
                    <div className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
                      <span className="truncate">
                        {channel.provider.name} · {channel.protocol} · P{channel.priority}
                      </span>
                      <span className="shrink-0">·</span>
                      <RouteRuntimePricingCell channel={channel} />
                    </div>
                  </div>
                </TableCell>
                <TableCell><EligibilityCell channel={channel} /></TableCell>
                <TableCell><RuntimeCell channel={channel} /></TableCell>
                <TableCell><ConcurrencyCell channel={channel} /></TableCell>
                <TableCell><TTFTCell channel={channel} /></TableCell>
                <TableCell><TrafficCell channel={channel} /></TableCell>
                <TableCell><ScoreCell channel={channel} /></TableCell>
                <TableCell><DistributionCell channel={channel} /></TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInspect(channel)}
                  >
                    <EyeIcon data-icon="inline-start" />
                    查看
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ColumnLabel({ label, tip }: { label: string; tip: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <HoverCard openDelay={120} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`${label}说明`}
          >
            <InfoIcon className="size-3.5" />
          </button>
        </HoverCardTrigger>
        <TipHoverCardContent align="start">{tip}</TipHoverCardContent>
      </HoverCard>
    </span>
  );
}

function RouteRuntimePricingCell({ channel }: { channel: RouteRuntimeChannel }) {
  const pricing = channel.pricing;
  const multiplier = pricing.cost_multiplier
    ? trimDecimal(pricing.cost_multiplier)
    : "—";
  const rechargeFactor = pricing.recharge_factor
    ? trimDecimal(pricing.recharge_factor)
    : "1";
  const summary =
    pricing.source === "absolute"
      ? "绝对成本"
      : pricing.source === "multiplier"
        ? `${multiplier} / ${rechargeFactor}`
        : "未配置";

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground shrink-0 text-xs tabular-nums hover:underline"
        >
          {summary}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="space-y-2">
          <div className="text-sm font-medium">当前模型成本</div>
          {pricing.source === "absolute" ? (
            <p className="text-muted-foreground text-xs">使用当前模型的渠道绝对成本。</p>
          ) : pricing.source === "multiplier" ? (
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">价格倍率</dt>
                <dd className="font-medium tabular-nums">{multiplier}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">充值倍率</dt>
                <dd className="font-medium tabular-nums">
                  {rechargeFactor}
                  {pricing.recharge_factor == null ? "（默认）" : ""}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-xs">当前模型没有可用的渠道成本。</p>
          )}
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

function EligibilityCell({ channel }: { channel: RouteRuntimeChannel }) {
  const eligibility = channel.eligibility;
  const variant = eligibility.status === "excluded" ? "destructive" : eligibility.status === "probe_only" ? "secondary" : "outline";
  const label = eligibility.status === "excluded" ? "无资格" : eligibility.status === "probe_only" ? "仅探测" : "有资格";
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex w-fit max-w-full cursor-default flex-col gap-1 text-left"
        >
          <Badge variant={variant}>{label}</Badge>
          {eligibility.primary_reason ? (
            <span className="max-w-32 truncate text-destructive text-xs">
              {reasonLabel(eligibility.primary_reason)}
            </span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <EligibilityTip channel={channel} />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function RuntimeCell({ channel }: { channel: RouteRuntimeChannel }) {
  const active = channel.runtime.state === "active" && channel.runtime.config_synchronized;
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={active ? "outline" : "destructive"}>
        {RUNTIME_LABELS[channel.runtime.state] ?? channel.runtime.state}
      </Badge>
      <span className="text-muted-foreground text-xs">
        {channel.runtime.config_synchronized ? "配置一致" : "配置未同步"}
      </span>
    </div>
  );
}

function ConcurrencyCell({ channel }: { channel: RouteRuntimeChannel }) {
  const value = channel.concurrency;
  const usagePct = value.unlimited || value.limit <= 0 ? 0 : Math.min(100, (value.used / value.limit) * 100);
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex w-full cursor-default flex-col gap-1.5 text-left">
          <div className="tabular-nums">
            {formatInt(value.used)} / {value.unlimited ? "不限" : formatInt(value.limit)}
          </div>
          <Progress value={usagePct} className="h-1.5" />
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <ConcurrencyTip channel={channel} />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function TTFTCell({ channel }: { channel: RouteRuntimeChannel }) {
  const metric = channel.quality.ttft;
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default tabular-nums underline decoration-dotted underline-offset-2">
          {metric.has_samples ? formatLatencyMs(metric.value) : "无样本"}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <TTFTTip channel={channel} />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function TrafficCell({ channel }: { channel: RouteRuntimeChannel }) {
  const traffic = channel.traffic;
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default font-medium tabular-nums underline decoration-dotted underline-offset-2">
          {formatInt(traffic.rpm)} RPM
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <TrafficTip channel={channel} />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function ScoreCell({ channel }: { channel: RouteRuntimeChannel }) {
  const probeOnly = channel.eligibility.status === "probe_only";
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default font-medium tabular-nums underline decoration-dotted underline-offset-2">
          {probeOnly ? "仅探测" : formatScore(channel.score.total)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <ScoreTip channel={channel} compact />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function DistributionCell({ channel }: { channel: RouteRuntimeChannel }) {
  const distribution = channel.distribution;
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default tabular-nums underline decoration-dotted underline-offset-2">
          {formatPercent(distribution.selected_share_1m)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        <DistributionTip channel={channel} />
      </TipHoverCardContent>
    </HoverCard>
  );
}

function ChannelDetailSheet({
  channel,
  open,
  onOpenChange,
}: {
  channel: RouteRuntimeChannel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const probeOnly = channel?.eligibility.status === "probe_only";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        {channel ? (
          <>
            <SheetHeader>
              <SheetTitle>{channel.channel_name}</SheetTitle>
              <SheetDescription>
                {channel.provider.name} · {channel.protocol} · {channel.adapter_key}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-4 pb-6">
                <DetailSection title="当前结论">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={channel.eligibility.status === "excluded" ? "destructive" : probeOnly ? "secondary" : "outline"}>
                      {channel.eligibility.status === "excluded" ? "无候选资格" : probeOnly ? "仅探测" : "有候选资格"}
                    </Badge>
                    <Badge variant={channel.runtime.state === "active" ? "outline" : "destructive"}>
                      {RUNTIME_LABELS[channel.runtime.state] ?? channel.runtime.state}
                    </Badge>
                    <Badge variant="secondary">顺序 {channel.order}</Badge>
                    {probeOnly ? (
                      <Badge variant="secondary">得分不参与普通排序</Badge>
                    ) : (
                      <Badge variant="secondary">得分 {formatScore(channel.score.total)}</Badge>
                    )}
                  </div>
                </DetailSection>

                <Separator />
                <DetailSection title="资格检查">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {channel.eligibility.checks.map((check) => (
                      <div key={check.key} className="flex items-start gap-2 rounded-md border p-2.5">
                        {check.status === "passed" ? <CheckCircle2Icon className="mt-0.5 size-4" /> : <CircleXIcon className="mt-0.5 size-4 text-destructive" />}
                        <div className="min-w-0">
                          <div className="font-medium">{ELIGIBILITY_LABELS[check.key] ?? check.key}</div>
                          <div className="text-muted-foreground text-xs">
                            {check.status === "passed" ? "通过" : reasonLabel(check.reason ?? "failed")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>

                <Separator />
                <DetailSection title={probeOnly ? "探测状态" : "五项评分"}>
                  <ScoreTip channel={channel} />
                </DetailSection>

                <Separator />
                <DetailSection title="容量与质量">
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <DetailValue label="并发占用">{formatInt(channel.concurrency.used)} / {channel.concurrency.unlimited ? "不限" : formatInt(channel.concurrency.limit)}</DetailValue>
                    <DetailValue label="平均上游 TTFT">{channel.quality.ttft.has_samples ? formatLatencyMs(channel.quality.ttft.value) : "无样本"}</DetailValue>
                    <DetailValue label="上游 TTFT 样本">{formatInt(channel.quality.ttft.sample_count)}</DetailValue>
                    <DetailValue label="错误率">{channel.quality.error_rate.has_samples ? formatPercentPoints(channel.quality.error_rate.value) : "无样本"}</DetailValue>
                    <DetailValue label="错误率样本">{formatInt(channel.quality.error_rate.sample_count)}</DetailValue>
                    <DetailValue label="RPM">{formatInt(channel.traffic.rpm)}</DetailValue>
                    <DetailValue label="RPD">{formatInt(channel.traffic.rpd)}</DetailValue>
                    <DetailValue label="TPM（观测）">{formatInt(channel.traffic.tpm)}</DetailValue>
                    <DetailValue label="Token 覆盖">{formatPercentPoints(channel.traffic.token_coverage_pct)}</DetailValue>
                  </dl>
                </DetailSection>

                <Separator />
                <DetailSection title="实际分流">
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <DetailValue label="1 分钟命中">{formatInt(channel.distribution.selected_1m)}</DetailValue>
                    <DetailValue label="1 分钟占比">{formatPercent(channel.distribution.selected_share_1m)}</DetailValue>
                    <DetailValue label="1 分钟回退">{formatInt(channel.distribution.fallback_1m)}</DetailValue>
                    <DetailValue label="5 分钟命中">{formatInt(channel.distribution.selected_5m)}</DetailValue>
                    <DetailValue label="5 分钟占比">{formatPercent(channel.distribution.selected_share_5m)}</DetailValue>
                  </dl>
                </DetailSection>

                <Accordion type="single" collapsible>
                  <AccordionItem value="diagnostics">
                    <AccordionTrigger>内部诊断</AccordionTrigger>
                    <AccordionContent>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Object.entries(channel.internal_diagnostics).map(([key, value]) => (
                          <DetailValue key={key} label={key}>{value ?? "—"}</DetailValue>
                        ))}
                      </dl>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-all tabular-nums">{children}</dd>
    </div>
  );
}

function RuntimeSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function RuntimeError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>实时路由加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
