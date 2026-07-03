import { useMemo, type ReactNode } from "react";
import { ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";
import type { RangeQuery, TimeseriesInterval } from "@/lib/api/dashboard";
import type { CompareIntent } from "@/lib/compare";
import { previousPeriodParams } from "@/lib/range";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** 趋势图配色（与 --chart-* 主题变量对齐）。 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** 时间桶刻度文案：按 interval 决定 分钟 / 小时 / 天 粒度。 */
export function fmtBucket(iso: string, interval: TimeseriesInterval): string {
  const d = new Date(iso);
  if (interval === "minute") {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (interval === "hour") {
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 趋势图上方「人话摘要」的着色意图。
export type StatIntent = "default" | "success" | "warning" | "danger";

export function statIntentClass(intent: StatIntent | undefined): string {
  switch (intent) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "danger":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

export function StatStrip({
  items,
}: {
  items: {
    label: string;
    value: string;
    intent?: StatIntent;
    compare?: string;
    compareIntent?: CompareIntent;
  }[];
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">{it.label}</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              statIntentClass(it.intent),
            )}
          >
            {it.value}
          </span>
          {it.compare != null && (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                statIntentClass(it.compareIntent),
              )}
            >
              环比 {it.compare}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** 上一等长周期的 range（用于趋势环比）；无 from/to 时返回 null。 */
export function usePreviousRange(range: RangeQuery): RangeQuery | null {
  const { from, to, interval, range: rangePreset } = range;
  return useMemo(() => {
    const prev = previousPeriodParams({ from, to });
    if (!prev) return null;
    return { from: prev.from, to: prev.to, interval, range: rangePreset };
  }, [from, to, interval, rangePreset]);
}

export function SloReferenceLine({
  yAxisId,
  y,
  label,
}: {
  yAxisId?: string;
  y: number;
  label: string;
}) {
  return (
    <ReferenceLine
      yAxisId={yAxisId}
      y={y}
      stroke="hsl(var(--muted-foreground))"
      strokeDasharray="5 4"
      strokeOpacity={0.55}
      ifOverflow="extendDomain"
      label={{
        value: label,
        position: "insideTopRight",
        fill: "hsl(var(--muted-foreground))",
        fontSize: 10,
      }}
    />
  );
}

// 趋势图 tooltip 单行：色块 + 名称 + 按该系列单位格式化的数值。
export function TipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: ReactNode;
  value: string;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className="h-2 w-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground ml-auto font-mono tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function ChartState({
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
