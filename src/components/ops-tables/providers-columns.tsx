import type { ColumnDef } from "@tanstack/react-table";
import type { ProviderOpsRow } from "@/lib/api/providersOps";
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

export function providerOpsColumns(): ColumnDef<ProviderOpsRow, unknown>[] {
  return [
    resizableColumn<ProviderOpsRow>("name", {
      header: "服务商",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.slug}</div>
        </>
      ),
    }),
    resizableColumn<ProviderOpsRow>("status", {
      header: "状态",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    }),
    resizableColumn<ProviderOpsRow>("channels", {
      header: "渠道",
      size: 88,
      cell: ({ row }) => `${row.original.channel_enabled}/${row.original.channel_total}`,
    }),
    resizableColumn<ProviderOpsRow>("health", {
      header: "健康",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={HEALTH_VARIANT[row.original.health]}>
          {HEALTH_LABEL[row.original.health]}
        </Badge>
      ),
    }),
    resizableColumn<ProviderOpsRow>("attempt_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.attempt_total),
    }),
    resizableColumn<ProviderOpsRow>("success_rate", {
      header: "成功率",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.success_rate),
    }),
    resizableColumn<ProviderOpsRow>("latency_avg", {
      header: "平均延迟",
      size: 112,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
    }),
    resizableColumn<ProviderOpsRow>("timeout_total", {
      header: "超时",
      size: 80,
      cell: ({ row }) => formatInt(row.original.timeout_total),
    }),
    resizableColumn<ProviderOpsRow>("last_success_at", {
      header: "最近成功",
      size: 140,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_success_at ? formatRelativeTime(row.original.last_success_at) : "—"}
        </span>
      ),
    }),
  ];
}
