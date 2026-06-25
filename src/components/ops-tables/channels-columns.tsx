import type { ColumnDef } from "@tanstack/react-table";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { resizableColumn } from "@/components/data-table";
import {
  formatCompact,
  formatInt,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function channelOpsColumns(): ColumnDef<ChannelOpsRow, unknown>[] {
  return [
    resizableColumn<ChannelOpsRow>("name", {
      header: "渠道",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {row.original.provider_name} · {row.original.base_url}
          </div>
        </>
      ),
    }),
    resizableColumn<ChannelOpsRow>("status", {
      header: "状态",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    }),
    resizableColumn<ChannelOpsRow>("health", {
      header: "健康",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={HEALTH_VARIANT[row.original.health]}>
          {HEALTH_LABEL[row.original.health]}
        </Badge>
      ),
    }),
    resizableColumn<ChannelOpsRow>("attempt_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.attempt_total),
    }),
    resizableColumn<ChannelOpsRow>("success_rate", {
      header: "成功率",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.success_rate),
    }),
    resizableColumn<ChannelOpsRow>("latency_avg", {
      header: "平均延迟",
      size: 112,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
    }),
    resizableColumn<ChannelOpsRow>("timeout_total", {
      header: "超时",
      size: 80,
      cell: ({ row }) => formatInt(row.original.timeout_total),
    }),
    resizableColumn<ChannelOpsRow>("bound_models", {
      header: "模型",
      size: 80,
      cell: ({ row }) => formatInt(row.original.bound_models),
    }),
    resizableColumn<ChannelOpsRow>("recent_error_code", {
      header: "最近错误",
      size: 140,
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate text-xs">
          {row.original.recent_error_code || "—"}
        </span>
      ),
    }),
    resizableColumn<ChannelOpsRow>("last_success_at", {
      header: "最近成功",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_success_at ? formatRelativeTime(row.original.last_success_at) : "—"}
        </span>
      ),
    }),
  ];
}
