import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { formatChartTs, formatCompact, formatLatencySec } from "@/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { MiniStat, SectionFrame } from "@/components/common/detail-section";

/** 归一化的性能时序点：total/succeeded 为量级，latencyMs 为该桶延迟（毫秒）。 */
export interface PerfPoint {
  bucket: string;
  total: number;
  succeeded: number;
  latencyMs: number;
}

/**
 * 详情页「性能」子表通用图表：区间量/成功率/平均延迟三卡 + 量级 AreaChart + 延迟 LineChart。
 * 渠道/服务商传 attempt 口径，模型/线路传 request 口径，由调用方归一化为 PerfPoint 并给出标签。
 */
export function PerformanceCharts({
  points,
  totalLabel,
  totalStatLabel,
  latencyLabel,
}: {
  points: PerfPoint[];
  /** 量级图例/维度词：尝试 / 请求。 */
  totalLabel: string;
  /** 量级汇总卡标题：总尝试 / 总请求。 */
  totalStatLabel: string;
  /** 延迟图例与卡标题：平均延迟 / P95 延迟。 */
  latencyLabel: string;
}) {
  const summary = useMemo(() => {
    const total = points.reduce((s, p) => s + p.total, 0);
    const succeeded = points.reduce((s, p) => s + p.succeeded, 0);
    const latPts = points.filter((p) => p.latencyMs > 0);
    const latencyMs = latPts.length
      ? latPts.reduce((s, p) => s + p.latencyMs, 0) / latPts.length
      : 0;
    return { total, succeeded, successRate: total ? succeeded / total : 0, latencyMs };
  }, [points]);

  const volumeData = useMemo(
    () => points.map((p) => ({ bucket: p.bucket, total: p.total, succeeded: p.succeeded })),
    [points],
  );
  const latencyData = useMemo(
    () => points.map((p) => ({ bucket: p.bucket, latency: p.latencyMs / 1000 })),
    [points],
  );

  const volConfig: ChartConfig = {
    total: { label: totalLabel, color: "var(--chart-1)" },
    succeeded: { label: "成功", color: "var(--chart-2)" },
  };
  const latConfig: ChartConfig = {
    latency: { label: `${latencyLabel} (s)`, color: "var(--chart-3)" },
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label={totalStatLabel} value={formatCompact(summary.total)} />
        <MiniStat
          label="成功率"
          value={
            <AttemptSuccessRateCell
              attemptTotal={summary.total}
              attemptSucceeded={summary.succeeded}
              successRate={summary.successRate}
              className="text-sm"
            />
          }
        />
        <MiniStat
          label={latencyLabel}
          value={summary.latencyMs > 0 ? formatLatencySec(summary.latencyMs) : "—"}
        />
      </div>

      <SectionFrame className="p-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium">{totalLabel}量</div>
        <ChartContainer config={volConfig} className="h-[200px] w-full">
          <AreaChart data={volumeData} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatChartTs}
            />
            <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(_, p) => formatChartTs(String(p?.[0]?.payload.bucket))} />
              }
            />
            <Area
              dataKey="total"
              type="monotone"
              stroke="var(--color-total)"
              fill="var(--color-total)"
              fillOpacity={0.15}
            />
            <Area
              dataKey="succeeded"
              type="monotone"
              stroke="var(--color-succeeded)"
              fill="var(--color-succeeded)"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ChartContainer>
      </SectionFrame>

      <SectionFrame className="p-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium">{latencyLabel}</div>
        <ChartContainer config={latConfig} className="h-[200px] w-full">
          <LineChart data={latencyData} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatChartTs}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value) => `${Number(value).toFixed(1)}s`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => formatChartTs(String(p?.[0]?.payload.bucket))}
                  formatter={(value) => `${Number(value).toFixed(2)}s`}
                />
              }
            />
            <Line
              dataKey="latency"
              type="monotone"
              stroke="var(--color-latency)"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </SectionFrame>
    </div>
  );
}
