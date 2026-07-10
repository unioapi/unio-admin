import type { ReactNode } from "react";
import type { ProviderOpsDetail } from "@/lib/api/providersOps";
import { profitIntent, type MetricThresholds } from "@/components/dashboard/metrics";
import { useMetricThresholds } from "@/hooks/useMetricThresholds";
import { RevenueTip } from "@/components/dashboard/RevenueTip";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { AttemptLatencyCell } from "@/components/table-cells/AttemptLatencyCell";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { cn } from "@/lib/utils";
import { formatCompact, formatTPS, formatUSD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function profitClass(marginUsd: string, th: MetricThresholds, revenueUsd?: string): string {
  const intent = profitIntent(Number(marginUsd), th, revenueUsd != null ? Number(revenueUsd) : undefined);
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

export function ProviderOverviewStats({ detail }: { detail: ProviderOpsDetail }) {
  const th = useMetricThresholds();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="渠道" value={`${detail.channel_enabled}/${detail.channel_total}`} />
      <Stat
        label="成功率"
        value={
          detail.attempt_total > 0 ? (
            <AttemptSuccessRateCell
              attemptTotal={detail.attempt_total}
              attemptSucceeded={detail.attempt_succeeded}
              successRate={detail.success_rate}
              className="font-heading text-base font-semibold"
            />
          ) : (
            "—"
          )
        }
      />
      <Stat
        label="平均延迟"
        value={
          <AttemptLatencyCell
            latency={detail.latency}
            className="font-heading text-base font-semibold"
          />
        }
      />
      <Stat label="Token" value={formatCompact(detail.tokens)} />
      <Stat label="平均 TPS" value={formatTPS(detail.avg_tps)} />
      <Stat
        label="利润"
        value={
          <HoverCard openDelay={120} closeDelay={120}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "cursor-default underline decoration-dotted underline-offset-2",
                  profitClass(detail.margin_usd, th, detail.revenue_usd),
                )}
              >
                {formatUSD(detail.margin_usd)}
              </button>
            </HoverCardTrigger>
            <TipHoverCardContent align="end">
              <RevenueTip
                revenue={{
                  revenue_usd: detail.revenue_usd,
                  cost_usd: detail.cost_usd,
                  margin_usd: detail.margin_usd,
                }}
              />
            </TipHoverCardContent>
          </HoverCard>
        }
      />
      <Stat
        label="健康"
        value={
          detail.health ? (
            <Badge variant={HEALTH_VARIANT[detail.health]}>{HEALTH_LABEL[detail.health]}</Badge>
          ) : (
            "—"
          )
        }
      />
    </div>
  );
}

export function ProviderOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}
