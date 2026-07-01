import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { RouteOpsRow } from "@/lib/api/routesOps";
import { AttemptSuccessRateCell } from "@/components/ops-tables/AttemptSuccessRateCell";
import { RouteRowActions } from "@/components/routes/RouteRowActions";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

const MODE_LABEL: Record<string, string> = {
  cheapest: "经济",
  stable: "稳定",
  fixed: "固定",
};

const facetedFilter: FilterFn<RouteOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const ROUTE_OS_COLUMN_LABELS: Record<string, string> = {
  name: "线路",
  status: "状态",
  serviceable: "可服务",
  mode: "策略",
  requests: "请求",
  success_rate: "成功率",
  latency: "P95 延迟",
  fallback: "Fallback",
  no_channel: "无可用渠道",
  bindings: "绑定",
  action: "操作",
};

export function routeOsColumns(): ColumnDef<RouteOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={`${row.original.pool_kind === "all" ? "全量动态" : "手挑渠道"}${
            row.original.pool_channels > 0 ? ` · ${row.original.pool_channels} 渠道` : ""
          }`}
        />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      filterFn: facetedFilter,
      enableHiding: false,
      meta: { label: "状态", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    },
    {
      id: "serviceable",
      accessorFn: (r) => (r.status !== "enabled" ? "disabled" : r.serviceable ? "ok" : "bad"),
      header: ({ column }) => <ColumnHeader column={column} title="可服务" />,
      enableSorting: false,
      meta: { label: "可服务", fixedWidth: true },
      cell: ({ row }) => {
        if (row.original.status !== "enabled") return <Badge variant="outline">停用</Badge>;
        return row.original.serviceable ? (
          <Badge variant="default">可服务</Badge>
        ) : (
          <Badge variant="destructive">异常</Badge>
        );
      },
    },
    {
      id: "mode",
      accessorKey: "mode",
      header: ({ column }) => <ColumnHeader column={column} title="策略" />,
      filterFn: facetedFilter,
      cell: ({ row }) => (
        <span className="text-xs">{MODE_LABEL[row.original.mode] ?? row.original.mode}</span>
      ),
    },
    {
      id: "requests",
      accessorKey: "request_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.request_total)}</span>
      ),
    },
    {
      id: "success_rate",
      accessorKey: "success_rate",
      header: ({ column }) => <ColumnHeader column={column} title="成功率" />,
      cell: ({ row }) => (
        <AttemptSuccessRateCell
          attemptTotal={row.original.request_total}
          attemptSucceeded={row.original.request_succeeded}
          successRate={row.original.success_rate}
        />
      ),
    },
    {
      id: "latency",
      accessorKey: "latency_p95",
      header: ({ column }) => <ColumnHeader column={column} title="P95 延迟" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatLatencyMs(row.original.latency_p95)}</span>
      ),
    },
    {
      id: "fallback",
      accessorKey: "fallback_rate",
      header: ({ column }) => <ColumnHeader column={column} title="Fallback" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatPercent(row.original.fallback_rate)}</span>
      ),
    },
    {
      id: "no_channel",
      accessorKey: "no_channel_total",
      header: ({ column }) => <ColumnHeader column={column} title="无可用渠道" />,
      cell: ({ row }) =>
        row.original.no_channel_total > 0 ? (
          <span className="text-destructive font-medium tabular-nums">
            {row.original.no_channel_total}
          </span>
        ) : (
          <span className="tabular-nums">0</span>
        ),
    },
    {
      id: "bindings",
      accessorFn: (r) => r.bound_users,
      header: ({ column }) => <ColumnHeader column={column} title="绑定" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.bound_users}/{row.original.bound_keys}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <RouteRowActions routeId={row.original.id} routeName={row.original.name} />
      ),
    },
  ];
}