import type { ColumnDef, FilterFn } from "@tanstack/react-table";
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
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

function toProvider(row: ProviderOpsRow): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    updated_at: "",
  };
}

const facetedFilter: FilterFn<ProviderOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const PROVIDER_OS_COLUMN_LABELS: Record<string, string> = {
  name: "服务商",
  status: "状态",
  channels: "渠道",
  models: "模型",
  routes: "线路",
  created_at: "创建时间",
  action: "操作",
};

export function providerOsColumns(): ColumnDef<ProviderOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="服务商" />,
      enableHiding: false,
      meta: {
        autoSizeValue: (row: ProviderOpsRow) => `${row.name} ${row.slug}`,
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
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: {
        label: "状态",
        autoSizeValue: (row: ProviderOpsRow) =>
          STATUS_LABEL[row.status] ?? row.status,
      },
      filterFn: facetedFilter,
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
      id: "channels",
      accessorFn: (r) => r.channel_total,
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
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
      header: () => <span className="text-muted-foreground">模型</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ProviderModelsCountCell providerId={row.original.id} count={row.original.models_count} />
      ),
    },
    {
      id: "routes",
      accessorFn: (r) => r.routes_count,
      header: () => <span className="text-muted-foreground">线路</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ProviderRoutesCountCell providerId={row.original.id} count={row.original.routes_count} />
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
      cell: ({ row }) => <ProviderRowActions provider={toProvider(row.original)} />,
    },
  ];
}
