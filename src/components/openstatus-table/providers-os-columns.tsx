import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Provider } from "@/lib/api/providers";
import type {
  ProviderOpsOrigin,
  ProviderOpsRow,
} from "@/lib/api/providersOps";
import {
  ProviderChannelsCountCell,
  ProviderModelsCountCell,
  ProviderRoutesCountCell,
} from "@/components/providers/ProviderListCountCells";
import { ProviderRowActions } from "@/components/providers/ProviderRowActions";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { STATUS_LABEL } from "@/components/dashboard/breakdown-table/constants";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { TruncateCell } from "./truncate-cell";
import type { FacetOption } from "./types";

/** 服务商状态筛选项（与 providers_status_check 一致：含归档）。 */
export const PROVIDER_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
];

function toProvider(row: ProviderOpsRow): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    updated_at: "",
    // ops 行不带归档时间；行操作只按 status 判断，archived_at 置空即可满足类型。
    archived_at: null,
    runtime_sync_pending: false,
    affected_origin_count: 0,
  };
}

export const PROVIDER_OS_COLUMN_LABELS: Record<string, string> = {
  name: "服务商",
  status: "状态",
  origins: "源站",
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
      id: "origins",
      accessorFn: (row) => (row.origins ?? []).length,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="源站" />
      ),
      enableSorting: false,
      meta: { label: "源站" },
      cell: ({ row }) => (
        <ProviderOriginsCell origins={row.original.origins ?? []} />
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

function ProviderOriginsCell({
  origins,
}: {
  origins: ProviderOpsOrigin[];
}) {
  const [open, setOpen] = useState(false);
  const count = origins.length;

  if (count === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`查看 ${count} 个源站`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs font-medium">源站（{count}）</div>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {origins.map((endpoint) => (
              <li key={endpoint.id} className="rounded-md border px-2 py-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{endpoint.name}</span>
                  <StatusBadge status={endpoint.status} />
                </div>
                <div
                  className="text-muted-foreground truncate font-mono text-[10px]"
                  title={endpoint.base_url}
                >
                  {endpoint.base_url}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}
