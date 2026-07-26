import type { ColumnDef } from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { ProviderOrigin } from "@/lib/api/providerOrigins";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import type { FacetOption } from "@/components/openstatus-table/types";

export const ORIGIN_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
];

export type ProviderOriginColumnDeps = {
  RuntimeSyncCell: ComponentType<{ endpoint: ProviderOrigin }>;
  BreakerCell: ComponentType<{ endpoint: ProviderOrigin }>;
  ErrorRateCell: ComponentType<{ endpoint: ProviderOrigin }>;
  Actions: ComponentType<{ endpoint: ProviderOrigin }>;
};

export function providerOriginColumns(
  deps: ProviderOriginColumnDeps,
): ColumnDef<ProviderOrigin, unknown>[] {
  const { RuntimeSyncCell, BreakerCell, ErrorRateCell, Actions } = deps;

  return [
    {
      id: "origin_name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="源站" />
      ),
      enableHiding: false,
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: "源站",
        variant: "text",
        placeholder: "搜索名称 / URL",
      },
      cell: ({ row }) => (
        <div className="max-w-96">
          <div className="font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate font-mono text-xs">
            {row.original.base_url}
          </div>
        </div>
      ),
    },
    {
      id: "origin_status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="状态" />
      ),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: "状态",
        variant: "select",
        options: ORIGIN_STATUS_OPTIONS,
      },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "channels",
      accessorKey: "channel_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="渠道" />
      ),
      enableSorting: false,
      meta: { label: "渠道" },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.channel_count}</span>
      ),
    },
    {
      id: "breaker",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="熔断" />
      ),
      enableSorting: false,
      meta: { label: "熔断" },
      cell: ({ row }) => <BreakerCell endpoint={row.original} />,
    },
    {
      id: "error_rate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="错误率" />
      ),
      enableSorting: false,
      meta: { label: "错误率" },
      cell: ({ row }) => <ErrorRateCell endpoint={row.original} />,
    },
    {
      id: "runtime_sync",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="运行态" />
      ),
      enableSorting: false,
      meta: { label: "运行态" },
      cell: ({ row }) => <RuntimeSyncCell endpoint={row.original} />,
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <Actions endpoint={row.original} />,
    },
  ];
}
