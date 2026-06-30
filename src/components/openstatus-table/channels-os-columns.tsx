import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { ChannelRowActions } from "@/components/channels/ChannelRowActions";
import { rateIntent } from "@/components/dashboard/metrics";
import {
  formatCompact,
  formatDateTime,
  formatInt,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

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

export const CHANNEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "渠道",
  requests: "请求",
  success_rate: "成功率",
  latency: "平均延迟",
  timeout: "超时",
  bound_models: "模型",
  recent_error: "最近错误",
  last_success: "最近成功",
  created_at: "创建时间",
  status: "状态",
  health: "健康",
  action: "操作",
};

export function channelOsColumns(): ColumnDef<ChannelOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={`${row.original.provider_name} · ${row.original.base_url}`}
        />
      ),
    },
    {
      id: "requests",
      accessorKey: "attempt_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.attempt_total)}</span>
      ),
    },
    {
      id: "success_rate",
      accessorKey: "success_rate",
      header: ({ column }) => <ColumnHeader column={column} title="成功率" />,
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
    {
      id: "latency",
      accessorFn: (r) => r.latency.avg,
      header: ({ column }) => <ColumnHeader column={column} title="平均延迟" />,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
    },
    {
      id: "timeout",
      accessorKey: "timeout_total",
      header: ({ column }) => <ColumnHeader column={column} title="超时" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatInt(row.original.timeout_total)}</span>
      ),
    },
    {
      id: "bound_models",
      accessorKey: "bound_models",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatInt(row.original.bound_models)}</span>
      ),
    },
    {
      id: "recent_error",
      accessorKey: "recent_error_code",
      header: ({ column }) => <ColumnHeader column={column} title="最近错误" />,
      enableSorting: false,
      cell: ({ row }) => (
        <TruncateCell
          className="text-muted-foreground text-xs"
          text={row.original.recent_error_code || "—"}
        />
      ),
    },
    {
      id: "last_success",
      accessorFn: (r) => r.last_success_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="最近成功" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.original.last_success_at
            ? formatRelativeTime(row.original.last_success_at)
            : "—"}
        </span>
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="创建时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: { label: "状态", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    },
    {
      id: "health",
      accessorKey: "health",
      header: ({ column }) => <ColumnHeader column={column} title="健康" />,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "健康", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={HEALTH_VARIANT[row.original.health]}>
          {HEALTH_LABEL[row.original.health]}
        </Badge>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <ChannelRowActions channelId={row.original.id} />,
    },
  ];
}
