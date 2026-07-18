import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ActivityIcon,
  CircleDollarSignIcon,
  ClockIcon,
  CoinsIcon,
  DatabaseIcon,
  HourglassIcon,
  ReceiptTextIcon,
  ZapIcon,
} from "lucide-react";
import {
  getPerformanceSeries,
  getRadar,
  getTimeseries,
  getTopErrors,
  type RadarReport,
  type RangeQuery,
  type RequestPoint,
  type SpendPoint,
  type TimeseriesInterval,
  type TokenPoint,
} from "@/lib/api/dashboard";
import {
  compareIntentHigherIsBetter,
  compareIntentLowerIsBetter,
  formatRatePointChange,
  formatRelativeChange,
  relativeChange,
} from "@/lib/compare";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { MetricCard, MetricGrid } from "@/components/common/MetricCard";
import { CacheHitHint, CacheHitTip } from "@/components/dashboard/CacheHitTip";
import {
  RequestSuccessHint,
  RequestSuccessTip,
} from "@/components/dashboard/RequestSuccessTip";
import { TtftHint, TtftTip } from "@/components/dashboard/TtftTip";
import { LatencyHint, LatencyTip } from "@/components/dashboard/LatencyTip";
import { RevenueHint, RevenueTip } from "@/components/dashboard/RevenueTip";
import {
  SettlementHint,
  SettlementTip,
} from "@/components/dashboard/SettlementTip";
import { TokenHint, TokenTip } from "@/components/dashboard/TokenTip";
import { TpsHint, TpsTip } from "@/components/dashboard/TpsTip";
import { BreakdownSection } from "@/components/dashboard/breakdown-table/BreakdownSection";
import { ConfigurableDataTable } from "@/components/data-table";
import { topErrorsColumns } from "@/components/detail-tables/dashboard-errors-columns";
import {
  BAD_CHANNELS_COLUMN_LABELS,
  badChannelsColumns,
} from "@/components/detail-tables/dashboard-columns";
import {
  latencyIntent,
  profitIntent,
  rateIntent,
  settlementAnomalyCount,
  settlementIntent,
  ttftIntent,
} from "@/components/dashboard/metrics";
import { useMetricThresholds } from "@/hooks/useMetricThresholds";
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
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CHART_COLORS,
  ChartState,
  SloReferenceLine,
  StatStrip,
  TipRow,
  fmtBucket,
  usePreviousRange,
  type StatIntent,
} from "@/components/dashboard/chart-common";

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
          <RadarCards data={radar.data} loading={radar.isPending} />
          <TrendsSection range={rangeQuery} interval={bucket} />
          <BreakdownSection range={rangeQuery} />
          <TopErrorsSection range={rangeQuery} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionItemsCard data={radar.data} loading={radar.isPending} />
            <BadChannelsCard data={radar.data} loading={radar.isPending} />
          </div>
        </>
      )}
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
  const th = useMetricThresholds();
  const r = data;
  const ttftValue =
    r && r.ttft.has_data ? formatLatencyMs(r.ttft.avg) : "—";

  return (
    <MetricGrid>
      <MetricCard
        label="请求成功率"
        loading={loading}
        value={formatPercent(r?.requests.success_rate ?? 0)}
        intent={r ? rateIntent(r.requests.success_rate, th) : "default"}
        icon={<ActivityIcon className="size-3.5" />}
        hint={r ? <RequestSuccessHint requests={r.requests} /> : undefined}
        tooltip={r ? <RequestSuccessTip requests={r.requests} /> : undefined}
      />
      <MetricCard
        label="平均延迟"
        loading={loading}
        value={formatLatencyMs(r?.latency.avg ?? 0)}
        icon={<ClockIcon className="size-3.5" />}
        hint={r ? <LatencyHint latency={r.latency} /> : undefined}
        tooltip={r ? <LatencyTip latency={r.latency} /> : undefined}
      />
      <MetricCard
        label="平均 TTFT"
        loading={loading}
        value={ttftValue}
        icon={<HourglassIcon className="size-3.5" />}
        hint={r ? <TtftHint ttft={r.ttft} /> : undefined}
        tooltip={r ? <TtftTip ttft={r.ttft} /> : undefined}
      />
      <MetricCard
        label="缓存命中率"
        loading={loading}
        value={formatPercent(r?.cache.read_rate ?? 0)}
        intent={r && r.cache.read_rate >= 0.5 ? "success" : "default"}
        icon={<DatabaseIcon className="size-3.5" />}
        hint={r ? <CacheHitHint cache={r.cache} /> : undefined}
        tooltip={r ? <CacheHitTip cache={r.cache} /> : undefined}
      />
      <MetricCard
        label="Token 总量"
        loading={loading}
        value={formatCompact(r?.tokens.total ?? 0)}
        icon={<CoinsIcon className="size-3.5" />}
        hint={r ? <TokenHint tokens={r.tokens} /> : undefined}
        tooltip={r ? <TokenTip tokens={r.tokens} cache={r.cache} /> : undefined}
      />
      <MetricCard
        label="平均 TPS"
        loading={loading}
        value={r ? formatTPS(r.tps) : "—"}
        icon={<ZapIcon className="size-3.5" />}
        hint={r ? <TpsHint output={r.tokens.output} /> : undefined}
        tooltip={r ? <TpsTip tps={r.tps} output={r.tokens.output} /> : undefined}
      />
      <MetricCard
        label="营收"
        loading={loading}
        value={r ? formatUSD(r.margin_usd) : "—"}
        intent={r ? profitIntent(Number(r.margin_usd), th, Number(r.revenue_usd)) : "default"}
        icon={<CircleDollarSignIcon className="size-3.5" />}
        hint={r ? <RevenueHint revenue={r} /> : undefined}
        tooltip={r ? <RevenueTip revenue={r} /> : undefined}
      />
      <MetricCard
        label="结算异常"
        loading={loading}
        value={formatInt(r ? settlementAnomalyCount(r) : 0)}
        intent={r ? settlementIntent(r) : "default"}
        icon={<ReceiptTextIcon className="size-3.5" />}
        hint={r ? <SettlementHint settlement={r} /> : undefined}
        tooltip={r ? <SettlementTip settlement={r} /> : undefined}
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
          <ConfigurableDataTable
            storageKey="dashboard:bad-channels"
            data={data.bad_channels}
            columns={badChannelsColumns()}
            columnLabels={BAD_CHANNELS_COLUMN_LABELS}
            layoutMode="content"
            bordered={false}
            getRowId={(row) => String(row.channel_id)}
            enablePagination={false}
            showViewOptions={false}
          />
        )}
      </CardContent>
    </Card>
  );
}

const TREND_TABS = [
  { value: "stability", label: "稳定性", desc: "请求量与成功率随时间的变化" },
  { value: "performance", label: "性能", desc: "延迟、首字时间与吞吐随时间的变化" },
  { value: "profit", label: "盈利", desc: "营收、成本与毛利随时间的变化" },
  { value: "usage", label: "用量", desc: "输入 / 输出 token 随时间的变化" },
] as const;

type TrendTab = (typeof TREND_TABS)[number]["value"];

function TrendsSection({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const [tab, setTab] = useState<TrendTab>("stability");
  const active = TREND_TABS.find((t) => t.value === tab) ?? TREND_TABS[0];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">趋势</CardTitle>
        <p className="text-muted-foreground text-sm">{active.desc}</p>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TrendTab)}>
          <TabsList>
            {TREND_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="stability" className="pt-4">
            <StabilityChart range={range} interval={interval} />
          </TabsContent>
          <TabsContent value="performance" className="pt-4">
            <PerformanceChart range={range} interval={interval} />
          </TabsContent>
          <TabsContent value="profit" className="pt-4">
            <ProfitChart range={range} interval={interval} />
          </TabsContent>
          <TabsContent value="usage" className="pt-4">
            <UsageChart range={range} interval={interval} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 稳定性：请求量（面积，左轴）+ 成功率（折线，右轴 0–100%）。回答「稳不稳 / 几点掉的」。
function StabilityChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const th = useMetricThresholds();
  const prevRange = usePreviousRange(range);
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
  const prevQ = useQuery({
    queryKey: ["dashboard", "ts", "requests", interval, "prev", prevRange],
    queryFn: () =>
      getTimeseries<RequestPoint>({
        metric: "requests",
        interval,
        from: prevRange!.from ?? "",
        to: prevRange!.to ?? "",
      }),
    enabled: !!prevRange,
    placeholderData: keepPreviousData,
  });
  const raw = q.data?.points ?? [];
  if (q.isPending || q.isError || raw.length === 0)
    return (
      <ChartState
        pending={q.isPending}
        error={q.error as Error | null}
        empty={raw.length === 0}
      />
    );

  const points = raw.map((p) => ({
    bucket: p.bucket,
    total: p.total,
    rate: p.total > 0 ? p.succeeded / p.total : null,
  }));
  const totalReq = raw.reduce((s, p) => s + p.total, 0);
  const totalOk = raw.reduce((s, p) => s + p.succeeded, 0);
  const avgRate = totalReq > 0 ? totalOk / totalReq : 0;
  const prevRaw = prevQ.data?.points ?? [];
  const prevTotalReq = prevRaw.reduce((s, p) => s + p.total, 0);
  const prevTotalOk = prevRaw.reduce((s, p) => s + p.succeeded, 0);
  const prevAvgRate =
    prevTotalReq > 0 ? prevTotalOk / prevTotalReq : null;
  const reqChange = relativeChange(totalReq, prevTotalReq);
  let worst: { rate: number; bucket: string } | null = null;
  for (const p of raw) {
    if (p.total <= 0) continue;
    const r = p.succeeded / p.total;
    if (worst === null || r < worst.rate) worst = { rate: r, bucket: p.bucket };
  }

  const config: ChartConfig = {
    total: { label: "请求数", color: CHART_COLORS[0] },
    rate: { label: "成功率", color: CHART_COLORS[1] },
  };
  return (
    <>
      <StatStrip
        items={[
          {
            label: "总请求",
            value: formatInt(totalReq),
            compare: prevQ.isSuccess
              ? formatRelativeChange(reqChange)
              : undefined,
            compareIntent: compareIntentHigherIsBetter(reqChange),
          },
          {
            label: "平均成功率",
            value: formatPercent(avgRate),
            intent: rateIntent(avgRate, th),
            compare:
              prevQ.isSuccess && prevAvgRate != null
                ? formatRatePointChange(avgRate, prevAvgRate)
                : undefined,
            compareIntent: compareIntentHigherIsBetter(
              prevAvgRate != null ? avgRate - prevAvgRate : null,
            ),
          },
          ...(worst
            ? [
                {
                  label: "最低成功率",
                  value: `${formatPercent(worst.rate)}（${fmtBucket(worst.bucket, interval)}）`,
                  intent: rateIntent(worst.rate, th),
                },
              ]
            : []),
        ]}
      />
      <ChartContainer config={config} className="h-[260px] w-full">
        <ComposedChart data={points} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v: string) => fmtBucket(v, interval)}
          />
          <YAxis
            yAxisId="vol"
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            domain={[0, 1]}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  fmtBucket(String(p?.[0]?.payload.bucket), interval)
                }
                formatter={(value, _name, item) => {
                  if (value == null) return null;
                  const key = String(item.dataKey ?? "");
                  const text =
                    key === "rate"
                      ? formatPercent(Number(value))
                      : formatInt(Number(value));
                  return (
                    <TipRow
                      color={item.color}
                      label={config[key]?.label}
                      value={text}
                    />
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <SloReferenceLine
            yAxisId="rate"
            y={th.successRateSlo}
            label={`SLO ${Math.round(th.successRateSlo * 100)}%`}
          />
          <Area
            yAxisId="vol"
            dataKey="total"
            type="monotone"
            stroke="var(--color-total)"
            fill="var(--color-total)"
            fillOpacity={0.15}
          />
          <Line
            yAxisId="rate"
            dataKey="rate"
            type="monotone"
            stroke="var(--color-rate)"
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        </ComposedChart>
      </ChartContainer>
    </>
  );
}

// 性能：P95 延迟 / P95 TTFT（左轴 ms）+ 平均 TPS（右轴 t/s）。回答「快不快 / 吞吐够不够」。
function PerformanceChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const th = useMetricThresholds();
  const prevRange = usePreviousRange(range);
  const q = useQuery({
    queryKey: ["dashboard", "ts", "performance", range],
    queryFn: () => getPerformanceSeries(range),
    placeholderData: keepPreviousData,
  });
  const prevQ = useQuery({
    queryKey: ["dashboard", "ts", "performance", "prev", prevRange],
    queryFn: () => getPerformanceSeries(prevRange!),
    enabled: !!prevRange,
    placeholderData: keepPreviousData,
  });
  const points = q.data?.points ?? [];
  if (q.isPending || q.isError || points.length === 0)
    return (
      <ChartState
        pending={q.isPending}
        error={q.error as Error | null}
        empty={points.length === 0}
      />
    );

  let latPeak: { v: number; bucket: string } | null = null;
  let ttftPeak: { v: number; bucket: string } | null = null;
  let tpsSum = 0;
  let tpsCount = 0;
  for (const p of points) {
    if (latPeak === null || p.latency_p95 > latPeak.v)
      latPeak = { v: p.latency_p95, bucket: p.bucket };
    if (ttftPeak === null || p.ttft_p95 > ttftPeak.v)
      ttftPeak = { v: p.ttft_p95, bucket: p.bucket };
    if (p.tps > 0) {
      tpsSum += p.tps;
      tpsCount += 1;
    }
  }
  const avgTps = tpsCount > 0 ? tpsSum / tpsCount : 0;

  const prevPoints = prevQ.data?.points ?? [];
  let prevLatPeak = 0;
  let prevTtftPeak = 0;
  let prevTpsSum = 0;
  let prevTpsCount = 0;
  for (const p of prevPoints) {
    if (p.latency_p95 > prevLatPeak) prevLatPeak = p.latency_p95;
    if (p.ttft_p95 > prevTtftPeak) prevTtftPeak = p.ttft_p95;
    if (p.tps > 0) {
      prevTpsSum += p.tps;
      prevTpsCount += 1;
    }
  }
  const prevAvgTps = prevTpsCount > 0 ? prevTpsSum / prevTpsCount : 0;

  const config: ChartConfig = {
    latency_p95: { label: "P95 延迟", color: CHART_COLORS[2] },
    ttft_p95: { label: "P95 TTFT", color: CHART_COLORS[3] },
    tps: { label: "TPS", color: CHART_COLORS[0] },
  };
  return (
    <>
      <StatStrip
        items={[
          ...(latPeak
            ? [
                {
                  label: "P95 延迟峰值",
                  value: `${formatLatencyMs(latPeak.v)}（${fmtBucket(latPeak.bucket, interval)}）`,
                  intent: latencyIntent(latPeak.v, th) as StatIntent,
                  compare: prevQ.isSuccess
                    ? formatRelativeChange(
                        relativeChange(latPeak.v, prevLatPeak),
                      )
                    : undefined,
                  compareIntent: compareIntentLowerIsBetter(
                    relativeChange(latPeak.v, prevLatPeak),
                  ),
                },
              ]
            : []),
          ...(ttftPeak
            ? [
                {
                  label: "P95 TTFT 峰值",
                  value: `${formatLatencyMs(ttftPeak.v)}（${fmtBucket(ttftPeak.bucket, interval)}）`,
                  intent: ttftIntent(ttftPeak.v, th) as StatIntent,
                  compare: prevQ.isSuccess
                    ? formatRelativeChange(
                        relativeChange(ttftPeak.v, prevTtftPeak),
                      )
                    : undefined,
                  compareIntent: compareIntentLowerIsBetter(
                    relativeChange(ttftPeak.v, prevTtftPeak),
                  ),
                },
              ]
            : []),
          {
            label: "平均 TPS",
            value: formatTPS(avgTps),
            compare: prevQ.isSuccess
              ? formatRelativeChange(relativeChange(avgTps, prevAvgTps))
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(avgTps, prevAvgTps),
            ),
          },
        ]}
      />
      <ChartContainer config={config} className="h-[260px] w-full">
        <ComposedChart data={points} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v: string) => fmtBucket(v, interval)}
          />
          <YAxis
            yAxisId="ms"
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => formatLatencyMs(v)}
          />
          <YAxis
            yAxisId="tps"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  fmtBucket(String(p?.[0]?.payload.bucket), interval)
                }
                formatter={(value, _name, item) => {
                  if (value == null) return null;
                  const key = String(item.dataKey ?? "");
                  const text =
                    key === "tps"
                      ? formatTPS(Number(value))
                      : formatLatencyMs(Number(value));
                  return (
                    <TipRow
                      color={item.color}
                      label={config[key]?.label}
                      value={text}
                    />
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <SloReferenceLine
            yAxisId="ms"
            y={th.latencyWarnMs}
            label={`延迟 ${formatLatencyMs(th.latencyWarnMs)}`}
          />
          <SloReferenceLine
            yAxisId="ms"
            y={th.ttftWarnMs}
            label={`TTFT ${formatLatencyMs(th.ttftWarnMs)}`}
          />
          <Line
            yAxisId="ms"
            dataKey="latency_p95"
            type="monotone"
            stroke="var(--color-latency_p95)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="ms"
            dataKey="ttft_p95"
            type="monotone"
            stroke="var(--color-ttft_p95)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="tps"
            dataKey="tps"
            type="monotone"
            stroke="var(--color-tps)"
            dot={false}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </ComposedChart>
      </ChartContainer>
    </>
  );
}

// 盈利：营收 vs 成本（折线）+ 毛利（面积）。回答「赚不赚钱 / 毛利走势」。
function ProfitChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const th = useMetricThresholds();
  const prevRange = usePreviousRange(range);
  const revenueQ = useQuery({
    queryKey: ["dashboard", "ts", "spend", interval, range],
    queryFn: () =>
      getTimeseries<SpendPoint>({
        metric: "spend",
        interval,
        from: range.from ?? "",
        to: range.to ?? "",
      }),
    placeholderData: keepPreviousData,
  });
  const costQ = useQuery({
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
  const prevRevenueQ = useQuery({
    queryKey: ["dashboard", "ts", "spend", interval, "prev", prevRange],
    queryFn: () =>
      getTimeseries<SpendPoint>({
        metric: "spend",
        interval,
        from: prevRange!.from ?? "",
        to: prevRange!.to ?? "",
      }),
    enabled: !!prevRange,
    placeholderData: keepPreviousData,
  });
  const prevCostQ = useQuery({
    queryKey: ["dashboard", "ts", "cost", interval, "prev", prevRange],
    queryFn: () =>
      getTimeseries<SpendPoint>({
        metric: "cost",
        interval,
        from: prevRange!.from ?? "",
        to: prevRange!.to ?? "",
      }),
    enabled: !!prevRange,
    placeholderData: keepPreviousData,
  });

  const pending = revenueQ.isPending || costQ.isPending;
  const error = (revenueQ.error ?? costQ.error) as Error | null;
  const points = mergeProfitPoints(
    revenueQ.data?.points ?? [],
    costQ.data?.points ?? [],
  );
  if (pending || error || points.length === 0)
    return (
      <ChartState pending={pending} error={error} empty={points.length === 0} />
    );

  const revTotal = points.reduce((s, p) => s + p.revenue, 0);
  const costTotal = points.reduce((s, p) => s + p.cost, 0);
  const marginTotal = revTotal - costTotal;
  const marginRate = revTotal > 0 ? marginTotal / revTotal : null;

  const prevPoints = mergeProfitPoints(
    prevRevenueQ.data?.points ?? [],
    prevCostQ.data?.points ?? [],
  );
  const prevRevTotal = prevPoints.reduce((s, p) => s + p.revenue, 0);
  const prevCostTotal = prevPoints.reduce((s, p) => s + p.cost, 0);
  const prevMarginTotal = prevRevTotal - prevCostTotal;
  const prevReady = prevRevenueQ.isSuccess && prevCostQ.isSuccess;

  const config: ChartConfig = {
    revenue: { label: "营收", color: CHART_COLORS[1] },
    cost: { label: "成本", color: CHART_COLORS[3] },
    margin: { label: "毛利", color: CHART_COLORS[0] },
  };
  return (
    <>
      <StatStrip
        items={[
          {
            label: "营收合计",
            value: formatUSD(revTotal),
            compare: prevReady
              ? formatRelativeChange(relativeChange(revTotal, prevRevTotal))
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(revTotal, prevRevTotal),
            ),
          },
          {
            label: "成本合计",
            value: formatUSD(costTotal),
            compare: prevReady
              ? formatRelativeChange(relativeChange(costTotal, prevCostTotal))
              : undefined,
            compareIntent: compareIntentLowerIsBetter(
              relativeChange(costTotal, prevCostTotal),
            ),
          },
          {
            label: "毛利合计",
            value:
              marginRate != null
                ? `${formatUSD(marginTotal)}（${formatPercent(marginRate)}）`
                : formatUSD(marginTotal),
            intent: profitIntent(marginTotal, th, revTotal) as StatIntent,
            compare: prevReady
              ? formatRelativeChange(
                  relativeChange(marginTotal, prevMarginTotal),
                )
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(marginTotal, prevMarginTotal),
            ),
          },
        ]}
      />
      <ChartContainer config={config} className="h-[260px] w-full">
        <ComposedChart data={points} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v: string) => fmtBucket(v, interval)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => formatUSD(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  fmtBucket(String(p?.[0]?.payload.bucket), interval)
                }
                formatter={(value, _name, item) => {
                  if (value == null) return null;
                  const key = String(item.dataKey ?? "");
                  return (
                    <TipRow
                      color={item.color}
                      label={config[key]?.label}
                      value={formatUSD(Number(value))}
                    />
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <SloReferenceLine y={0} label="盈亏平衡" />
          <Area
            dataKey="margin"
            type="monotone"
            stroke="var(--color-margin)"
            fill="var(--color-margin)"
            fillOpacity={0.12}
          />
          <Line
            dataKey="revenue"
            type="monotone"
            stroke="var(--color-revenue)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            dataKey="cost"
            type="monotone"
            stroke="var(--color-cost)"
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ChartContainer>
    </>
  );
}

// 合并营收（spend）与成本（cost）的 USD 时序，按 bucket 对齐，缺失侧按 0 计。
function mergeProfitPoints(
  revenue: SpendPoint[],
  cost: SpendPoint[],
): { bucket: string; revenue: number; cost: number; margin: number }[] {
  const map = new Map<string, { bucket: string; revenue: number; cost: number }>();
  for (const p of revenue) {
    if (p.currency !== "USD") continue;
    map.set(p.bucket, { bucket: p.bucket, revenue: Number(p.amount), cost: 0 });
  }
  for (const p of cost) {
    if (p.currency !== "USD") continue;
    const e = map.get(p.bucket) ?? { bucket: p.bucket, revenue: 0, cost: 0 };
    e.cost = Number(p.amount);
    map.set(p.bucket, e);
  }
  return [...map.values()]
    .sort(
      (a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime(),
    )
    .map((e) => ({ ...e, margin: e.revenue - e.cost }));
}

// 用量：输入 / 输出 token 堆叠面积。回答「用得多不多」。
function UsageChart({
  range,
  interval,
}: {
  range: RangeQuery;
  interval: TimeseriesInterval;
}) {
  const prevRange = usePreviousRange(range);
  const q = useQuery({
    queryKey: ["dashboard", "ts", "tokens", interval, range],
    queryFn: () =>
      getTimeseries<TokenPoint>({
        metric: "tokens",
        interval,
        from: range.from ?? "",
        to: range.to ?? "",
      }),
    placeholderData: keepPreviousData,
  });
  const prevQ = useQuery({
    queryKey: ["dashboard", "ts", "tokens", interval, "prev", prevRange],
    queryFn: () =>
      getTimeseries<TokenPoint>({
        metric: "tokens",
        interval,
        from: prevRange!.from ?? "",
        to: prevRange!.to ?? "",
      }),
    enabled: !!prevRange,
    placeholderData: keepPreviousData,
  });
  const points = q.data?.points ?? [];
  if (q.isPending || q.isError || points.length === 0)
    return (
      <ChartState
        pending={q.isPending}
        error={q.error as Error | null}
        empty={points.length === 0}
      />
    );

  const inputTotal = points.reduce((s, p) => s + p.input, 0);
  const outputTotal = points.reduce((s, p) => s + p.output, 0);
  const tokenTotal = inputTotal + outputTotal;

  const prevPoints = prevQ.data?.points ?? [];
  const prevInputTotal = prevPoints.reduce((s, p) => s + p.input, 0);
  const prevOutputTotal = prevPoints.reduce((s, p) => s + p.output, 0);
  const prevTokenTotal = prevInputTotal + prevOutputTotal;

  const config: ChartConfig = {
    input: { label: "输入 token", color: CHART_COLORS[0] },
    output: { label: "输出 token", color: CHART_COLORS[4] },
  };
  return (
    <>
      <StatStrip
        items={[
          {
            label: "输入 token",
            value: formatInt(inputTotal),
            compare: prevQ.isSuccess
              ? formatRelativeChange(relativeChange(inputTotal, prevInputTotal))
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(inputTotal, prevInputTotal),
            ),
          },
          {
            label: "输出 token",
            value: formatInt(outputTotal),
            compare: prevQ.isSuccess
              ? formatRelativeChange(
                  relativeChange(outputTotal, prevOutputTotal),
                )
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(outputTotal, prevOutputTotal),
            ),
          },
          {
            label: "合计",
            value: formatInt(tokenTotal),
            compare: prevQ.isSuccess
              ? formatRelativeChange(relativeChange(tokenTotal, prevTokenTotal))
              : undefined,
            compareIntent: compareIntentHigherIsBetter(
              relativeChange(tokenTotal, prevTokenTotal),
            ),
          },
        ]}
      />
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
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  fmtBucket(String(p?.[0]?.payload.bucket), interval)
                }
                formatter={(value, _name, item) => {
                  if (value == null) return null;
                  const key = String(item.dataKey ?? "");
                  return (
                    <TipRow
                      color={item.color}
                      label={config[key]?.label}
                      value={formatInt(Number(value))}
                    />
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="input"
            type="monotone"
            stackId="tok"
            stroke="var(--color-input)"
            fill="var(--color-input)"
            fillOpacity={0.18}
          />
          <Area
            dataKey="output"
            type="monotone"
            stackId="tok"
            stroke="var(--color-output)"
            fill="var(--color-output)"
            fillOpacity={0.18}
          />
        </AreaChart>
      </ChartContainer>
    </>
  );
}

// 失败原因 Top：区间内失败请求按错误码聚合，回答「为什么失败」。深链到失败请求列表。
function TopErrorsSection({ range }: { range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["dashboard", "errors", range],
    queryFn: () => getTopErrors(range),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">失败原因 Top</CardTitle>
        <p className="text-muted-foreground text-sm">
          区间内失败请求按错误码聚合，点「查看」进入失败请求列表
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {q.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{(q.error as Error).message}</AlertDescription>
          </Alert>
        ) : (q.data?.errors.length ?? 0) === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            区间内暂无失败请求
          </p>
        ) : (
          <ConfigurableDataTable
            storageKey="dashboard:top-errors"
            data={q.data!.errors}
            columns={topErrorsColumns()}
            pinnedColumnId="code"
            bordered={false}
            getRowId={(e) => e.code}
            enablePagination={false}
            showViewOptions={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
