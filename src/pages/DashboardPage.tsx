import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BadgePercentIcon,
  CircleCheckIcon,
  CircleDollarSignIcon,
  ClockIcon,
  CoinsIcon,
  DatabaseIcon,
  HourglassIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import {
  getBreakdown,
  getPerformanceSeries,
  getRadar,
  getTimeseries,
  type BreakdownDimension,
  type HealthBucket,
  type PlatformLevel,
  type RadarReport,
  type RangeQuery,
  type RequestPoint,
  type SpendPoint,
  type TimeseriesInterval,
} from "@/lib/api/dashboard";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { MetricCard, MetricGrid } from "@/components/common/MetricCard";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatTPS,
  formatUSD,
} from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function fmtBucket(iso: string, interval: TimeseriesInterval): string {
  const d = new Date(iso);
  if (interval === "minute") {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (interval === "hour") {
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 成功率/毛利的 intent 色板。
function rateIntent(rate: number): "success" | "warning" | "danger" {
  if (rate >= 0.95) return "success";
  if (rate >= 0.8) return "warning";
  return "danger";
}

const HEALTH_LABEL: Record<HealthBucket, string> = {
  healthy: "健康",
  degraded: "降级",
  unhealthy: "不健康",
  no_data: "无数据",
};

const HEALTH_VARIANT: Record<HealthBucket, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  degraded: "secondary",
  unhealthy: "destructive",
  no_data: "outline",
};

export function DashboardPage() {
  const { value, setRange, params, bucket, refresh, refreshedAt } =
    useRangeQuery("24h");
  const rangeQuery: RangeQuery = { ...params, range: value.preset, interval: bucket };

  const radar = useQuery({
    queryKey: ["dashboard", "radar", rangeQuery],
    queryFn: () => getRadar(rangeQuery),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            概览
          </h2>
          <p className="text-muted-foreground text-sm">
            全平台值班雷达 · 异常发现与深链处理
          </p>
        </div>
        <RangeFilter
          value={value}
          onChange={setRange}
          refreshedAt={refreshedAt}
          onRefresh={refresh}
        />
      </div>

      {radar.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(radar.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <>
          <PlatformBanner data={radar.data} loading={radar.isPending} />
          <RadarCards data={radar.data} loading={radar.isPending} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionItemsCard data={radar.data} loading={radar.isPending} />
            <BadChannelsCard data={radar.data} loading={radar.isPending} />
          </div>
          <TrendsSection range={rangeQuery} interval={bucket} />
          <BreakdownSection range={rangeQuery} />
        </>
      )}
    </div>
  );
}

const PLATFORM_META: Record<
  PlatformLevel,
  { label: string; className: string }
> = {
  healthy: {
    label: "平台正常",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  degraded: {
    label: "平台降级",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  down: {
    label: "平台异常",
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
  },
  insufficient_data: {
    label: "样本不足",
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

function PlatformBanner({
  data,
  loading,
}: {
  data?: RadarReport;
  loading: boolean;
}) {
  if (loading && !data) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (!data) return null;
  const status = data.platform_status;
  const meta = PLATFORM_META[status.level] ?? PLATFORM_META.insufficient_data;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${meta.className}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-heading text-base font-semibold">{meta.label}</span>
        <span className="text-sm opacity-80">{status.reason}</span>
      </div>
      <div className="flex items-center gap-4 text-xs tabular-nums opacity-90">
        <span>近 15 分钟成功率 {formatPercent(status.success_rate)}</span>
        <span>样本 {formatInt(status.terminal)}</span>
        {status.no_channel > 0 ? (
          <span>无可用渠道 {formatInt(status.no_channel)}</span>
        ) : null}
      </div>
    </div>
  );
}

function RadarCards({
  data,
  loading,
}: {
  data?: RadarReport;
  loading: boolean;
}) {
  const r = data;
  const ttftValue =
    r && r.ttft.has_data ? formatLatencyMs(r.ttft.p95) : "—";
  const marginNum = r ? Number(r.margin_usd) : 0;

  return (
    <MetricGrid>
      <MetricCard
        label="请求量"
        loading={loading}
        value={formatCompact(r?.requests.total ?? 0)}
        hint={r ? `成功 ${formatCompact(r.requests.succeeded)}` : undefined}
        icon={<ActivityIcon className="size-3.5" />}
        tooltip={
          r
            ? `成功 ${r.requests.succeeded} · 失败 ${r.requests.failed} · 取消 ${r.requests.canceled} · 超时 ${r.requests.timeout}`
            : undefined
        }
      />
      <MetricCard
        label="成功率"
        loading={loading}
        value={formatPercent(r?.requests.success_rate ?? 0)}
        intent={r ? rateIntent(r.requests.success_rate) : "default"}
        icon={<CircleCheckIcon className="size-3.5" />}
        tooltip={
          r
            ? `失败率 ${formatPercent(r.requests.error_rate)} · 超时 ${r.requests.timeout}`
            : undefined
        }
      />
      <MetricCard
        label="P95 延迟"
        loading={loading}
        value={formatLatencyMs(r?.latency.p95 ?? 0)}
        icon={<ClockIcon className="size-3.5" />}
        tooltip={
          r
            ? `Avg ${formatLatencyMs(r.latency.avg)} · P50 ${formatLatencyMs(r.latency.p50)} · P90 ${formatLatencyMs(r.latency.p90)} · P99 ${formatLatencyMs(r.latency.p99)}`
            : undefined
        }
      />
      <MetricCard
        label="P95 TTFT"
        loading={loading}
        value={ttftValue}
        icon={<HourglassIcon className="size-3.5" />}
        tooltip={
          r && !r.ttft.has_data
            ? "暂无首 token 时间数据（历史请求未记录响应起始时间；后端重启后新请求会开始写入）"
            : r
              ? `P50 ${formatLatencyMs(r.ttft.p50)}`
              : undefined
        }
      />
      <MetricCard
        label="缓存命中率"
        loading={loading}
        value={formatPercent(r?.cache.read_rate ?? 0)}
        icon={<DatabaseIcon className="size-3.5" />}
        tooltip={
          r
            ? `写入率 ${formatPercent(r.cache.write_rate)} · 输入 token ${formatCompact(r.cache.input_tokens)}`
            : undefined
        }
      />
      <MetricCard
        label="Token"
        loading={loading}
        value={formatCompact(r?.tokens.total ?? 0)}
        icon={<CoinsIcon className="size-3.5" />}
        tooltip={
          r
            ? `输入 ${formatCompact(r.tokens.input)} · 输出 ${formatCompact(r.tokens.output)}`
            : undefined
        }
      />
      <MetricCard
        label="TPS"
        loading={loading}
        value={r ? formatTPS(r.tps) : "—"}
        icon={<ZapIcon className="size-3.5" />}
        tooltip="成功请求平均输出 token 速度"
      />
      <MetricCard
        label="收入"
        loading={loading}
        value={formatUSD(r?.revenue_usd ?? "0")}
        icon={<CircleDollarSignIcon className="size-3.5" />}
        tooltip="客户结算扣费（USD）"
      />
      <MetricCard
        label="成本"
        loading={loading}
        value={formatUSD(r?.cost_usd ?? "0")}
        icon={<TrendingUpIcon className="size-3.5" />}
        tooltip="平台上游成本（USD）"
      />
      <MetricCard
        label="毛利"
        loading={loading}
        value={formatUSD(r?.margin_usd ?? "0")}
        intent={marginNum < 0 ? "danger" : "success"}
        icon={<BadgePercentIcon className="size-3.5" />}
        tooltip="收入 − 成本（USD）"
      />
      <MetricCard
        label="计费异常"
        loading={loading}
        value={formatInt(r?.billing_exceptions.total ?? 0)}
        intent={r && r.billing_exceptions.total > 0 ? "danger" : "default"}
        icon={<ReceiptTextIcon className="size-3.5" />}
        hint={r ? `平台承担 ${formatUSD(r.billing_exceptions.amount)}` : undefined}
        tooltip="区间内新增计费异常事件"
      />
      <MetricCard
        label="结算积压"
        loading={loading}
        value={formatInt(r?.settlement_backlog.active ?? 0)}
        intent={
          r && r.settlement_backlog.dead > 0
            ? "danger"
            : r && r.settlement_backlog.active > 0
              ? "warning"
              : "default"
        }
        icon={<AlertTriangleIcon className="size-3.5" />}
        hint={r ? `失败 ${formatInt(r.settlement_backlog.dead)}` : undefined}
        tooltip="结算补偿任务：进行中 active / 已耗尽需人工 dead"
      />
    </MetricGrid>
  );
}

function ActionItemsCard({
  data,
  loading,
}: {
  data?: RadarReport;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">需要处理</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <Skeleton className="h-24 w-full" />
        ) : !data || data.action_items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            暂无需要处理的事项
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.action_items.map((item, i) => (
              <li
                key={`${item.kind}-${i}`}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5"
              >
                <div className="flex items-start gap-2">
                  <Badge
                    variant={item.severity === "danger" ? "destructive" : "secondary"}
                  >
                    {item.severity === "danger" ? "紧急" : "注意"}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.detail}
                    </div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={item.deeplink}>查看</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BadChannelsCard({
  data,
  loading,
}: {
  data?: RadarReport;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">异常渠道 Top</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <Skeleton className="h-24 w-full" />
        ) : !data || data.bad_channels.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            区间内暂无异常渠道
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>渠道</TableHead>
                <TableHead>健康</TableHead>
                <TableHead className="text-right">成功率</TableHead>
                <TableHead>最近错误</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bad_channels.map((c) => (
                <TableRow key={c.channel_id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={HEALTH_VARIANT[c.bucket]}>
                      {HEALTH_LABEL[c.bucket]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(c.success_rate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[10rem] truncate text-xs">
                    {c.recent_error_code || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/channels?channel_id=${c.channel_id}`}>查看</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TrendsSection({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const [tab, setTab] = useState("health");
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">趋势</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="health">请求健康</TabsTrigger>
            <TabsTrigger value="performance">性能</TabsTrigger>
            <TabsTrigger value="cost">成本效率</TabsTrigger>
          </TabsList>
          <TabsContent value="health" className="pt-4">
            <HealthChart range={range} interval={interval} />
          </TabsContent>
          <TabsContent value="performance" className="pt-4">
            <PerformanceChart range={range} interval={interval} />
          </TabsContent>
          <TabsContent value="cost" className="pt-4">
            <CostChart range={range} interval={interval} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ChartState({
  pending,
  error,
  empty,
}: {
  pending: boolean;
  error?: Error | null;
  empty?: boolean;
}) {
  if (pending) return <Skeleton className="h-[260px] w-full" />;
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  if (empty)
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        区间内暂无数据
      </p>
    );
  return null;
}

function HealthChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const q = useQuery({
    queryKey: ["dashboard", "ts", "requests", interval, range],
    queryFn: () =>
      getTimeseries<RequestPoint>({
        metric: "requests",
        interval,
        from: range.from ?? "",
        to: range.to ?? "",
      }),
    placeholderData: keepPreviousData,
  });
  const points = q.data?.points ?? [];
  const state = (
    <ChartState pending={q.isPending} error={q.error as Error | null} empty={points.length === 0} />
  );
  if (q.isPending || q.isError || points.length === 0) return state;

  const config: ChartConfig = {
    total: { label: "请求数", color: CHART_COLORS[0] },
    succeeded: { label: "成功", color: CHART_COLORS[1] },
  };
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={points} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => fmtBucket(v, interval)}
        />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => fmtBucket(String(p?.[0]?.payload.bucket), interval)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area dataKey="total" type="monotone" stroke="var(--color-total)" fill="var(--color-total)" fillOpacity={0.15} />
        <Area dataKey="succeeded" type="monotone" stroke="var(--color-succeeded)" fill="var(--color-succeeded)" fillOpacity={0.15} />
      </AreaChart>
    </ChartContainer>
  );
}

function PerformanceChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const q = useQuery({
    queryKey: ["dashboard", "ts", "performance", range],
    queryFn: () => getPerformanceSeries(range),
    placeholderData: keepPreviousData,
  });
  const points = q.data?.points ?? [];
  if (q.isPending || q.isError || points.length === 0)
    return (
      <ChartState pending={q.isPending} error={q.error as Error | null} empty={points.length === 0} />
    );

  const config: ChartConfig = {
    latency_p95: { label: "P95 延迟(ms)", color: CHART_COLORS[2] },
    ttft_p95: { label: "P95 TTFT(ms)", color: CHART_COLORS[3] },
  };
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart data={points} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => fmtBucket(v, interval)}
        />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => fmtBucket(String(p?.[0]?.payload.bucket), interval)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="latency_p95" type="monotone" stroke="var(--color-latency_p95)" dot={false} strokeWidth={2} />
        <Line dataKey="ttft_p95" type="monotone" stroke="var(--color-ttft_p95)" dot={false} strokeWidth={2} />
      </LineChart>
    </ChartContainer>
  );
}

function CostChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const q = useQuery({
    queryKey: ["dashboard", "ts", "cost", interval, range],
    queryFn: () =>
      getTimeseries<SpendPoint>({
        metric: "cost",
        interval,
        from: range.from ?? "",
        to: range.to ?? "",
      }),
    placeholderData: keepPreviousData,
  });
  const usdPoints = (q.data?.points ?? [])
    .filter((p) => p.currency === "USD")
    .map((p) => ({ bucket: p.bucket, amount: Number(p.amount) }));
  if (q.isPending || q.isError || usdPoints.length === 0)
    return (
      <ChartState pending={q.isPending} error={q.error as Error | null} empty={usdPoints.length === 0} />
    );

  const config: ChartConfig = {
    amount: { label: "成本(USD)", color: CHART_COLORS[4] },
  };
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={usdPoints} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => fmtBucket(v, interval)}
        />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => fmtBucket(String(p?.[0]?.payload.bucket), interval)}
            />
          }
        />
        <Area dataKey="amount" type="monotone" stroke="var(--color-amount)" fill="var(--color-amount)" fillOpacity={0.15} />
      </AreaChart>
    </ChartContainer>
  );
}

const BREAKDOWN_TABS: { value: BreakdownDimension; label: string }[] = [
  { value: "route", label: "线路" },
  { value: "channel", label: "渠道" },
  { value: "model", label: "模型" },
];

function BreakdownSection({ range }: { range: RangeQuery }) {
  const [dim, setDim] = useState<BreakdownDimension>("route");
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">分组表现</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs value={dim} onValueChange={(v) => setDim(v as BreakdownDimension)}>
          <TabsList>
            {BREAKDOWN_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {BREAKDOWN_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="pt-4">
              <BreakdownTable dimension={t.value} range={range} active={dim === t.value} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

const BREAKDOWN_LINK: Record<BreakdownDimension, string> = {
  route: "/routes",
  channel: "/channels",
  model: "/models",
};

function BreakdownTable({
  dimension,
  range,
  active,
}: {
  dimension: BreakdownDimension;
  range: RangeQuery;
  active: boolean;
}) {
  const q = useQuery({
    queryKey: ["dashboard", "breakdown", dimension, range],
    queryFn: () => getBreakdown(dimension, range),
    placeholderData: keepPreviousData,
    enabled: active,
  });

  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{(q.error as Error).message}</AlertDescription>
      </Alert>
    );
  const rows = q.data?.rows ?? [];
  if (rows.length === 0)
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        区间内暂无数据
      </p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{BREAKDOWN_TABS.find((t) => t.value === dimension)?.label}</TableHead>
          <TableHead className="text-right">请求</TableHead>
          <TableHead className="text-right">成功率</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={`${row.label}-${i}`}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCompact(row.terminal)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPercent(row.success_rate)}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="ghost">
                <Link
                  to={
                    row.ref_id != null
                      ? `${BREAKDOWN_LINK[dimension]}?${dimension === "route" ? "route_id" : dimension === "channel" ? "channel_id" : "model_id"}=${row.ref_id}`
                      : BREAKDOWN_LINK[dimension]
                  }
                >
                  查看
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
