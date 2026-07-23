import type { ChannelOpsRow, ChannelRuntime } from "@/lib/api/channelsOps";
import type { RuntimeSyncState } from "@/lib/api/runtime";
import { errorCodeLabel } from "@/components/dashboard/breakdown-table/constants";
import { ChannelCircuitBreakerSummary } from "@/components/channels/ChannelOverviewStats";
import { channelRuntimeStateLabel } from "@/components/channels/ChannelCircuitBreakerBadge";
import { formatPercent } from "@/lib/format";
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
  runtime,
  runtimeSyncState,
}: {
  channel: { priority: number };
  opsRow?: ChannelOpsRow | null;
  runtime?: ChannelRuntime | null;
  runtimeSyncState?: RuntimeSyncState;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <InfoItem label="优先级">
        <span className="tabular-nums">{channel.priority}</span>
      </InfoItem>
      <InfoItem label="成功率">
        {opsRow ? (
          <span className="tabular-nums">
            {opsRow.attempt_total > 0 ? formatPercent(opsRow.success_rate) : "无样本"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </InfoItem>
      <InfoItem label="熔断">
        <ChannelCircuitBreakerSummary
          breaker={runtime?.breaker}
          runtimeSyncState={runtimeSyncState}
        />
      </InfoItem>
      <InfoItem label="运行态">
        {runtimeSyncState === "active" ? (
          <span className="tabular-nums">
            已对账 · 限额 v{runtime?.runtime_admission_active_revision ?? "—"}
          </span>
        ) : (
          <span className="text-destructive">
            {channelRuntimeStateLabel(runtimeSyncState) ?? "加载中"}
          </span>
        )}
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
