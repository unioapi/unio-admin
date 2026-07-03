import type { UserOpsDetail } from "@/lib/api/customerOps";
import { formatCompact, formatInt, formatPercent, formatUSD } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function UserOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}

/** 详情页区间指标（余额快照在列表已展示，此处不重复）。 */
export function UserOverviewStats({
  detail,
  keyTotal,
  keyEnabled,
}: {
  detail: UserOpsDetail;
  keyTotal: number;
  keyEnabled: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="API Key" value={`${formatInt(keyEnabled)}/${formatInt(keyTotal)}`} />
      <Stat label="区间请求" value={formatCompact(detail.request_total)} />
      <Stat label="区间消费" value={formatUSD(detail.consumption_usd)} />
      <Stat label="成功率" value={formatPercent(detail.success_rate)} />
    </div>
  );
}
