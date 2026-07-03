import type { ReactNode } from "react";
import type { RouteOpsDetail } from "@/lib/api/routesOps";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

function ServiceableStat({ detail }: { detail: RouteOpsDetail }) {
  if (detail.route_status !== "enabled") {
    return <Stat label="可服务" value={<Badge variant="outline">停用</Badge>} />;
  }
  return (
    <Stat
      label="可服务"
      value={
        detail.serviceable ? (
          <Badge variant="default">可服务</Badge>
        ) : (
          <Badge variant="destructive">异常</Badge>
        )
      }
    />
  );
}

export function RouteOverviewStats({ detail }: { detail: RouteOpsDetail }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <ServiceableStat detail={detail} />
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
      <Stat label="Fallback 次数" value={formatCompact(detail.fallback_total)} />
    </div>
  );
}

export function RouteOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}
