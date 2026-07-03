import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import type {
  BreakdownDimension,
  BreakdownRow,
  HealthBucket,
} from "@/lib/api/dashboard";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatTPS,
  formatUSD,
} from "@/lib/format";
import {
  latencyIntent,
  profitIntent,
  rateIntent,
} from "@/components/dashboard/metrics";
import { RevenueTip } from "@/components/dashboard/RevenueTip";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { ChannelSuccessRateCell } from "@/components/common/ChannelSuccessRateCell";
import { AttemptLatencyCell } from "@/components/table-cells/AttemptLatencyCell";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  BREAKDOWN_COLUMN_MIN_SIZE,
  BREAKDOWN_COLUMN_SIZE,
  BREAKDOWN_COLUMNS,
  STATUS_LABEL,
  errorCodeLabel,
  requestsCountLabel,
  type BreakdownColumnId,
} from "./constants";

const HEALTH_LABEL: Record<HealthBucket, string> = {
  healthy: "健康",
  degraded: "降级",
  unhealthy: "不健康",
  no_data: "无数据",
};

const HEALTH_VARIANT: Record<
  HealthBucket,
  "default" | "secondary" | "destructive" | "outline"
> = {
  healthy: "default",
  degraded: "secondary",
  unhealthy: "destructive",
  no_data: "outline",
};

type StatIntent = "default" | "success" | "warning" | "danger";

function statIntentClass(intent: StatIntent | undefined): string {
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

function renderChannelSuccessRateCell(row: BreakdownRow) {
  return (
    <ChannelSuccessRateCell
      successRate={row.success_rate}
      buckets={row.success_buckets}
    />
  );
}

function breakdownStatusBadge(status: string) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={status === "enabled" ? "default" : "secondary"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function columnMeta(id: BreakdownColumnId) {
  return {
    id,
    size: BREAKDOWN_COLUMN_SIZE[id],
    minSize: BREAKDOWN_COLUMN_MIN_SIZE[id],
    maxSize: 480,
    enableResizing: true,
    enableHiding: id !== "name",
  };
}

export function createBreakdownColumns(
  dimension: BreakdownDimension,
  nameLabel: string,
): ColumnDef<BreakdownRow>[] {
  const ids = BREAKDOWN_COLUMNS[dimension];

  const defs: Record<BreakdownColumnId, ColumnDef<BreakdownRow>> = {
    name: {
      ...columnMeta("name"),
      accessorKey: "label",
      header: nameLabel,
      cell: ({ row }) => (
        <span className="block truncate font-medium">{row.original.label}</span>
      ),
    },
    status: {
      ...columnMeta("status"),
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => breakdownStatusBadge(row.original.status),
    },
    health: {
      ...columnMeta("health"),
      accessorKey: "health_bucket",
      header: "健康",
      cell: ({ row }) => {
        const bucket = row.original.health_bucket || "no_data";
        return (
          <Badge variant={HEALTH_VARIANT[bucket] ?? "outline"}>
            {HEALTH_LABEL[bucket] ?? "无数据"}
          </Badge>
        );
      },
    },
    requests: {
      ...columnMeta("requests"),
      accessorKey: "terminal",
      header: requestsCountLabel(dimension),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.terminal)}</span>
      ),
    },
    succeeded: {
      ...columnMeta("succeeded"),
      accessorKey: "succeeded",
      header: "成功",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCompact(row.original.succeeded)}
        </span>
      ),
    },
    failed: {
      ...columnMeta("failed"),
      accessorKey: "failed",
      header: "失败",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCompact(row.original.failed ?? 0)}
        </span>
      ),
    },
    success_rate: {
      ...columnMeta("success_rate"),
      ...(dimension === "channel" ? { size: 192, minSize: 192 } : null),
      accessorKey: "success_rate",
      header: "成功率",
      cell: ({ row }) =>
        dimension === "channel" ? (
          renderChannelSuccessRateCell(row.original)
        ) : (
          <span
            className={cn(
              "tabular-nums",
              statIntentClass(rateIntent(row.original.success_rate)),
            )}
          >
            {formatPercent(row.original.success_rate)}
          </span>
        ),
    },
    channels: {
      ...columnMeta("channels"),
      accessorKey: "channel_count",
      header: "渠道数",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatInt(row.original.channel_count ?? 0)}
        </span>
      ),
    },
    tokens: {
      ...columnMeta("tokens"),
      accessorKey: "tokens",
      header: "Token",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.tokens)}</span>
      ),
    },
    margin: {
      ...columnMeta("margin"),
      accessorKey: "margin_usd",
      header: "利润",
      cell: ({ row }) => (
        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className={cn(
                "cursor-default tabular-nums underline decoration-dotted underline-offset-2",
                statIntentClass(
                  profitIntent(Number(row.original.margin_usd), Number(row.original.revenue_usd)),
                ),
              )}
            >
              {formatUSD(row.original.margin_usd)}
            </button>
          </HoverCardTrigger>
          <TipHoverCardContent align="end">
            <RevenueTip revenue={row.original} title={row.original.label} />
          </TipHoverCardContent>
        </HoverCard>
      ),
    },
    latency: {
      ...columnMeta("latency"),
      accessorKey: "latency",
      header: "平均延迟",
      cell: ({ row }) => {
        if (row.original.latency) {
          return <AttemptLatencyCell latency={row.original.latency} />;
        }
        const ms = row.original.latency_p95;
        return (
          <span
            className={cn(
              "tabular-nums",
              ms > 0 ? statIntentClass(latencyIntent(ms)) : undefined,
            )}
          >
            {ms > 0 ? formatLatencyMs(ms) : "—"}
          </span>
        );
      },
    },
    tps: {
      ...columnMeta("tps"),
      accessorKey: "avg_tps",
      header: "平均 TPS",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatTPS(row.original.avg_tps)}</span>
      ),
    },
    recent_error: {
      ...columnMeta("recent_error"),
      accessorKey: "recent_error",
      header: "最近错误",
      cell: ({ row }) => (
        <span className="text-muted-foreground block truncate text-xs">
          {row.original.recent_error
            ? errorCodeLabel(row.original.recent_error)
            : "—"}
        </span>
      ),
    },
  };

  return ids.map((id) => ({
    ...defs[id],
    id,
  }));
}
