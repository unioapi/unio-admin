import type { ColumnDef } from "@tanstack/react-table";
import type { Provider } from "@/lib/api/providers";
import type { ProviderOpsRow } from "@/lib/api/providersOps";
import {
  ProviderChannelsCountCell,
  ProviderModelsCountCell,
  ProviderRoutesCountCell,
} from "@/components/providers/ProviderListCountCells";
import { ProviderRowActions } from "@/components/providers/ProviderRowActions";
import { STATUS_LABEL } from "@/components/dashboard/breakdown-table/constants";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { TruncateCell } from "./truncate-cell";
import type { FacetOption } from "./types";

/** 服务商状态筛选项（与 providers_status_check 一致：含归档）。 */
const PROVIDER_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
];

function toProvider(row: ProviderOpsRow): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    origin: row.origin,
    origin_revision: row.origin_revision,
    status: row.status,
    status_revision: row.status_revision,
    created_at: row.created_at,
    updated_at: "",
    // ops 行不带归档时间；行操作只按 status 判断，archived_at 置空即可满足类型。
    archived_at: null,
    runtime_sync_pending: false,
  };
}

export function providerOsColumns(): ColumnDef<ProviderOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="服务商" />
      ),
      enableHiding: false,
      enableColumnFilter: true,
      meta: {
        label: "服务商",
        variant: "text",
        placeholder: "搜索名称 / slug",
      },
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={row.original.slug}
        />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="状态" />
      ),
      enableHiding: false,
      enableColumnFilter: true,
      meta: {
        label: "状态",
        variant: "select",
        options: PROVIDER_STATUS_OPTIONS,
      },
      cell: ({ row }) =>
        row.original.status ? (
          <Badge variant={row.original.status === "enabled" ? "default" : "secondary"}>
            {STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "origin",
      accessorKey: "origin",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="API Root" />
      ),
      enableSorting: false,
      meta: { label: "API Root" },
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.origin}
          className="font-mono text-xs"
          subtext={`origin v${row.original.origin_revision} · status v${row.original.status_revision}`}
        />
      ),
    },
    {
      id: "channels",
      accessorFn: (r) => r.channel_total,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="渠道" />
      ),
      meta: { label: "渠道" },
      cell: ({ row }) => (
        <ProviderChannelsCountCell
          providerId={row.original.id}
          count={row.original.channel_total}
        />
      ),
    },
    {
      id: "models",
      accessorFn: (r) => r.models_count,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="模型" />
      ),
      enableSorting: false,
      meta: { label: "模型" },
      cell: ({ row }) => (
        <ProviderModelsCountCell providerId={row.original.id} count={row.original.models_count} />
      ),
    },
    {
      id: "routes",
      accessorFn: (r) => r.routes_count,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="线路" />
      ),
      enableSorting: false,
      meta: { label: "线路" },
      cell: ({ row }) => (
        <ProviderRoutesCountCell providerId={row.original.id} count={row.original.routes_count} />
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="创建时间" />
      ),
      meta: { label: "创建时间" },
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
      cell: ({ row }) => <ProviderRowActions provider={toProvider(row.original)} />,
    },
  ];
}
