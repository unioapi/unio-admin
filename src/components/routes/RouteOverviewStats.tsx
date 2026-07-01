import type { ReactNode } from "react";
import type { RouteOpsDetail } from "@/lib/api/routesOps";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card p-2.5", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "font-heading mt-0.5 text-base font-semibold tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function RouteOverviewStats({ detail }: { detail: RouteOpsDetail }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="请求" value={formatCompact(detail.request_total)} />
      <Stat label="成功率" value={formatPercent(detail.success_rate)} />
      <Stat label="Fallback 率" value={formatPercent(detail.fallback_rate)} />
      <Stat
        label="无可用渠道"
        value={String(detail.no_channel_total)}
        valueClassName={detail.no_channel_total > 0 ? "text-destructive" : undefined}
      />
      <Stat label="P50 延迟" value={formatLatencyMs(detail.latency_p50)} />
      <Stat label="P95 延迟" value={formatLatencyMs(detail.latency_p95)} />
    </div>
  );
}

export function RouteOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}
