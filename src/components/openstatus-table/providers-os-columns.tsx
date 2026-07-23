import { useState } from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { Provider } from "@/lib/api/providers";
import type {
  ProviderOpsEndpoint,
  ProviderOpsRow,
} from "@/lib/api/providersOps";
import {
  ProviderChannelsCountCell,
  ProviderModelsCountCell,
  ProviderRoutesCountCell,
} from "@/components/providers/ProviderListCountCells";
import { ProviderRowActions } from "@/components/providers/ProviderRowActions";
import { StatusBadge } from "@/components/common/StatusBadge";
import { STATUS_LABEL } from "@/components/dashboard/breakdown-table/constants";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ColumnHeader } from "./column-header";
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
    affected_endpoint_count: 0,
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
  endpoints: "端点",
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
      id: "endpoints",
      accessorFn: (row) => row.endpoints,
      header: () => <span className="text-muted-foreground">端点</span>,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ProviderOpsRow) =>
          (row.endpoints ?? [])
            .map((endpoint) => `${endpoint.name} ${endpoint.base_url}`)
            .join(" "),
      },
      cell: ({ row }) => (
        <ProviderEndpointsCell endpoints={row.original.endpoints ?? []} />
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

function ProviderEndpointsCell({
  endpoints,
}: {
  endpoints: ProviderOpsEndpoint[];
}) {
  const [hiddenOpen, setHiddenOpen] = useState(false);

  if (endpoints.length === 0) {
    return <span className="text-muted-foreground text-xs">暂无端点</span>;
  }

  const visible = endpoints.slice(0, 2);
  const hidden = endpoints.slice(2);

  return (
    <div className="flex min-w-56 max-w-80 flex-col gap-1.5 py-0.5">
      {visible.map((endpoint) => (
        <EndpointSummary key={endpoint.id} endpoint={endpoint} />
      ))}
      {hidden.length > 0 ? (
        <HoverCard
          open={hiddenOpen}
          onOpenChange={setHiddenOpen}
          openDelay={150}
          closeDelay={100}
        >
          <HoverCardTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="w-fit"
              aria-expanded={hiddenOpen}
              onClick={() => setHiddenOpen(true)}
            >
              另有 {hidden.length} 个端点
            </Button>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-96">
            <div className="flex flex-col gap-2">
              {hidden.map((endpoint) => (
                <EndpointSummary key={endpoint.id} endpoint={endpoint} />
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : null}
    </div>
  );
}

function EndpointSummary({ endpoint }: { endpoint: ProviderOpsEndpoint }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{endpoint.name}</span>
        <StatusBadge status={endpoint.status} />
      </div>
      <div
        className="text-muted-foreground truncate font-mono text-xs"
        title={endpoint.base_url}
      >
        {endpoint.base_url}
      </div>
    </div>
  );
}
