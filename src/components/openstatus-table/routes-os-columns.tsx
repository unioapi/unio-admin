import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { RouteOpsRow } from "@/lib/api/routesOps";
import { RateLimitSummaryCell } from "@/components/rate-limit/RateLimitSummaryCell";
import { RouteChannelsCell } from "@/components/routes/RouteChannelsCell";
import { RouteModelsCountCell } from "@/components/routes/RouteModelsCountCell";
import { RouteRowActions } from "@/components/routes/RouteRowActions";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";
import type { FacetOption } from "./types";

/** 线路状态筛选项（与 routes_status_check 一致：含归档）。 */
export const ROUTE_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
];

const facetedFilter: FilterFn<RouteOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const ROUTE_OS_COLUMN_LABELS: Record<string, string> = {
  name: "线路",
  status: "状态",
  mode: "策略",
  rate_limit: "限流",
  channels: "渠道",
  price_ratio: "倍率",
  models: "模型",
  bindings: "绑定数",
  created_at: "创建时间",
  action: "操作",
};

export function routeOsColumns(): ColumnDef<RouteOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      enableHiding: false,
      meta: {
        autoSizeValue: (row: RouteOpsRow) =>
          row.description ? `${row.name} ${row.description}` : row.name,
      },
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={row.original.description || undefined}
        />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      filterFn: facetedFilter,
      enableHiding: false,
      meta: { label: "状态" },
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      id: "mode",
      accessorKey: "mode",
      header: ({ column }) => <ColumnHeader column={column} title="策略" />,
      filterFn: facetedFilter,
      cell: ({ row }) => (
        <span className="text-xs">{ROUTE_MODE_LABEL[row.original.mode] ?? row.original.mode}</span>
      ),
    },
    {
      id: "rate_limit",
      header: () => <span className="text-muted-foreground">限流</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <RateLimitSummaryCell
          rpm={row.original.rpm_limit}
          tpm={row.original.tpm_limit}
          rpd={row.original.rpd_limit}
          scopeLabel="线路级限流"
          defaultScope="线路"
        />
      ),
    },
    {
      id: "channels",
      accessorFn: (r) => r.pool_channels,
      header: () => <span className="text-muted-foreground">渠道</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <RouteChannelsCell
          routeId={row.original.id}
          count={row.original.pool_channels}
        />
      ),
    },
    {
      id: "price_ratio",
      accessorKey: "price_ratio",
      header: () => <span className="text-muted-foreground">倍率</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums text-xs">
          {formatRouteRatioInput(row.original.price_ratio) || "1"}
        </span>
      ),
    },
    {
      id: "models",
      accessorFn: (r) => r.models_count,
      header: () => <span className="text-muted-foreground">模型</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <RouteModelsCountCell routeId={row.original.id} count={row.original.models_count} />
      ),
    },
    {
      id: "bindings",
      accessorFn: (r) => r.bound_keys,
      header: ({ column }) => <ColumnHeader column={column} title="绑定数" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.bound_keys}</span>
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
