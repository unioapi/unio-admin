import type { ReactNode } from "react";
import type { ChannelOpsDetail } from "@/lib/api/channelsOps";
import type { BreakdownRow } from "@/lib/api/dashboard";
import { formatInt, formatRelativeTime } from "@/lib/format";
import { AttemptLatencyCell } from "@/components/table-cells/AttemptLatencyCell";
import { ChannelSuccessRateCell } from "@/components/common/ChannelSuccessRateCell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card p-2.5", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function ChannelOverviewStats({
  detail,
  breakdownRow,
}: {
  detail: ChannelOpsDetail;
  /** 概览「表现 → 渠道」中该渠道那一行，原样驱动成功率列 */
  breakdownRow?: BreakdownRow;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <div className="min-w-0 overflow-hidden rounded-md border bg-card p-2.5">
        <div className="text-muted-foreground text-xs">成功率</div>
        <div className="mt-1.5 min-w-0 overflow-hidden">
          <ChannelSuccessRateCell
            successRate={breakdownRow?.success_rate ?? detail.success_rate}
            buckets={breakdownRow?.success_buckets}
            className="w-full min-w-0 max-w-full"
            barWidthClass="min-w-0 w-full"
          />
        </div>
      </div>

      <Stat label="超时" value={formatInt(detail.timeout_total)} />
      <Stat
        label="平均延迟"
        value={
          <AttemptLatencyCell
            latency={detail.latency}
            className="font-heading text-base font-semibold"
          />
        }
      />
      <Stat
        label="最近成功"
        value={detail.last_success_at ? formatRelativeTime(detail.last_success_at) : "—"}
      />
      <Stat
        label="最近失败"
        value={detail.last_failure_at ? formatRelativeTime(detail.last_failure_at) : "—"}
      />
    </div>
  );
}

export function ChannelOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}
