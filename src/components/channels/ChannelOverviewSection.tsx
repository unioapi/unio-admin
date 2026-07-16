import type { ChannelCircuitBreakerStatus, ChannelOpsRow } from "@/lib/api/channelsOps";
import { errorCodeLabel } from "@/components/dashboard/breakdown-table/constants";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { ChannelCircuitBreakerSummary } from "@/components/channels/ChannelOverviewStats";
import { Badge } from "@/components/ui/badge";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function InfoItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/40 px-3 py-2.5", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 min-w-0 text-sm">{children}</div>
    </div>
  );
}

export function ChannelOverviewSection({
  channel,
  opsRow,
  circuitBreaker,
}: {
  channel: { priority: number };
  opsRow?: ChannelOpsRow | null;
  circuitBreaker?: ChannelCircuitBreakerStatus | null;
}) {
  const breaker = circuitBreaker ?? opsRow?.circuit_breaker ?? null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <InfoItem label="优先级">
        <span className="tabular-nums">{channel.priority}</span>
      </InfoItem>
      <InfoItem label="健康">
        {opsRow ? (
          <Badge variant={HEALTH_VARIANT[opsRow.health]}>{HEALTH_LABEL[opsRow.health]}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </InfoItem>
      <InfoItem label="熔断">
        <ChannelCircuitBreakerSummary breaker={breaker} />
      </InfoItem>
      <InfoItem label="最近错误">
        {opsRow?.recent_error_code ? (
          <TruncateCell
            className="text-xs"
            text={errorCodeLabel(opsRow.recent_error_code)}
            title={opsRow.recent_error_code}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </InfoItem>
    </div>
  );
}
