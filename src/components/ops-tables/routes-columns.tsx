import type { ColumnDef } from "@tanstack/react-table";
import type { RouteOpsRow } from "@/lib/api/routesOps";
import { resizableColumn } from "@/components/data-table";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const MODE_LABEL: Record<string, string> = {
  cheapest: "经济",
  stable: "稳定",
  fixed: "固定",
};

export function routeOpsColumns(): ColumnDef<RouteOpsRow, unknown>[] {
  return [
    resizableColumn<RouteOpsRow>("name", {
      header: "线路",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="flex items-center gap-1.5 truncate font-medium">
            {row.original.name}
            {row.original.is_builtin ? <Badge variant="outline">内置</Badge> : null}
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {row.original.pool_kind === "all" ? "全量动态" : "手挑渠道"}
            {row.original.pool_channels > 0 ? ` · ${row.original.pool_channels} 渠道` : ""}
          </div>
        </>
      ),
    }),
    resizableColumn<RouteOpsRow>("mode", {
      header: "策略",
      size: 88,
      cell: ({ row }) => (
        <span className="text-xs">{MODE_LABEL[row.original.mode] ?? row.original.mode}</span>
      ),
    }),
    resizableColumn<RouteOpsRow>("serviceable", {
      header: "可服务",
      size: 96,
      cell: ({ row }) => {
        if (row.original.status !== "enabled") {
          return <Badge variant="outline">停用</Badge>;
        }
        return row.original.serviceable ? (
          <Badge variant="default">可服务</Badge>
        ) : (
          <Badge variant="destructive">异常</Badge>
        );
      },
    }),
    resizableColumn<RouteOpsRow>("request_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.request_total),
    }),
    resizableColumn<RouteOpsRow>("success_rate", {
      header: "成功率",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.success_rate),
    }),
    resizableColumn<RouteOpsRow>("latency_p95", {
      header: "P95 延迟",
      size: 112,
      cell: ({ row }) => formatLatencyMs(row.original.latency_p95),
    }),
    resizableColumn<RouteOpsRow>("fallback_rate", {
      header: "Fallback",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.fallback_rate),
    }),
    resizableColumn<RouteOpsRow>("no_channel_total", {
      header: "无可用渠道",
      size: 112,
      cell: ({ row }) =>
        row.original.no_channel_total > 0 ? (
          <span className="text-destructive font-medium">{row.original.no_channel_total}</span>
        ) : (
          0
        ),
    }),
    resizableColumn<RouteOpsRow>("bindings", {
      header: "绑定",
      size: 96,
      cell: ({ row }) => `${row.original.bound_projects}/${row.original.bound_keys}`,
    }),
  ];
}
