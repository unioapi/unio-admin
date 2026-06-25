import { Link } from "react-router-dom";
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
  formatUSD,
} from "@/lib/format";
import {
  latencyIntent,
  profitIntent,
  rateIntent,
} from "@/components/dashboard/metrics";
import { RevenueTip } from "@/components/dashboard/RevenueTip";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  BREAKDOWN_COLUMN_MIN_SIZE,
  BREAKDOWN_COLUMN_SIZE,
  BREAKDOWN_COLUMNS,
  BREAKDOWN_LINK,
  BREAKDOWN_REF_PARAM,
  STATUS_LABEL,
  errorCodeLabel,
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
      header: "请求",
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
      accessorKey: "success_rate",
      header: "成功率",
      cell: ({ row }) => (
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
                statIntentClass(profitIntent(Number(row.original.margin_usd))),
              )}
            >
              {formatUSD(row.original.margin_usd)}
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            align="end"
            className="w-auto max-w-[calc(100vw-2rem)] p-3"
          >
            <RevenueTip revenue={row.original} title={row.original.label} />
          </HoverCardContent>
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
    action: {
      ...columnMeta("action"),
      id: "action",
      header: "操作",
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link
            to={
              row.original.ref_id != null
                ? `${BREAKDOWN_LINK[dimension]}?${BREAKDOWN_REF_PARAM[dimension]}=${row.original.ref_id}`
                : BREAKDOWN_LINK[dimension]
            }
          >
            查看
          </Link>
        </Button>
      ),
    },
  };

  return ids.map((id) => ({
    ...defs[id],
    id,
  }));
}
