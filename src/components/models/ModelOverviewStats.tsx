import type { ReactNode } from "react";
import type { ModelOpsDetail } from "@/lib/api/modelsOps";
import { formatCompact, formatLatencyMs, formatPercent, formatTPS, formatUSD } from "@/lib/format";
import { profitIntent } from "@/components/dashboard/metrics";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  intentClass,
}: {
  label: string;
  value: ReactNode;
  intentClass?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "font-heading mt-0.5 text-base font-semibold tabular-nums",
          intentClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ModelOverviewStats({ detail }: { detail: ModelOpsDetail }) {
  const failed = Math.max(0, detail.request_total - detail.request_succeeded);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="请求" value={formatCompact(detail.request_total)} />
      <Stat
        label="成功率"
        value={
          <AttemptSuccessRateCell
            attemptTotal={detail.request_total}
            attemptSucceeded={detail.request_succeeded}
            successRate={detail.success_rate}
            className="font-heading text-base font-semibold"
          />
        }
      />
      <Stat label="失败" value={formatCompact(failed)} />
      <Stat label="平均延迟" value={formatLatencyMs(detail.latency_avg)} />
      <Stat label="P95 延迟" value={formatLatencyMs(detail.latency_p95)} />
      <Stat label="TPS" value={formatTPS(detail.tps)} />
      <Stat label="缓存命中率" value={formatPercent(detail.cache_read_rate)} />
      <Stat label="输出 Token" value={formatCompact(detail.output_tokens)} />
      <Stat label="收入 (USD)" value={formatUSD(detail.revenue_usd)} />
      <Stat
        label="毛利 (USD)"
        value={formatUSD(detail.margin_usd)}
        intentClass={cn(profitIntent(Number(detail.margin_usd), Number(detail.revenue_usd)))}
      />
      <Stat label="毛利率" value={formatPercent(detail.margin_rate)} />
    </div>
  );
}

export function ModelOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 11 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}
