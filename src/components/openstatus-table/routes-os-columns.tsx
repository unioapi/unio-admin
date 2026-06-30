import { useState } from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { EyeIcon, PencilIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouteOpsRow } from "@/lib/api/routesOps";
import { getRoute, type Route } from "@/lib/api/routes";
import { rateIntent } from "@/components/dashboard/metrics";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

const MODE_LABEL: Record<string, string> = {
  cheapest: "经济",
  stable: "稳定",
  fixed: "固定",
};

type StatIntent = "default" | "success" | "warning" | "danger";

function statIntentClass(intent: StatIntent | undefined): string {
  switch (intent) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "danger":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

const facetedFilter: FilterFn<RouteOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const ROUTE_OS_COLUMN_LABELS: Record<string, string> = {
  name: "线路",
  mode: "策略",
  serviceable: "可服务",
  requests: "请求",
  success_rate: "成功率",
  latency: "P95 延迟",
  fallback: "Fallback",
  no_channel: "无可用渠道",
  bindings: "绑定",
  status: "状态",
  action: "操作",
};

function EditRouteAction({ row }: { row: RouteOpsRow }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const routeQ = useQuery({
    queryKey: ["route", row.id],
    queryFn: () => getRoute(row.id),
    enabled: open,
  });
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="编辑"
        onClick={() => setOpen(true)}
      >
        <PencilIcon />
      </Button>
      {open && routeQ.data ? (
        <RouteFormDialog
          open={open}
          onOpenChange={setOpen}
          route={routeQ.data as Route}
          onSaved={() => {
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ["routes"] });
            queryClient.invalidateQueries({ queryKey: ["route", row.id] });
          }}
        />
      ) : null}
    </>
  );
}

export function routeOsColumns(): ColumnDef<RouteOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={
            <span className="inline-flex items-center gap-1.5">
              {row.original.name}
            </span>
          }
          title={row.original.name}
          className="font-medium"
          subtext={`${row.original.pool_kind === "all" ? "全量动态" : "手挑渠道"}${
            row.original.pool_channels > 0 ? ` · ${row.original.pool_channels} 渠道` : ""
          }`}
        />
      ),
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
      id: "serviceable",
      accessorFn: (r) => (r.status !== "enabled" ? "disabled" : r.serviceable ? "ok" : "bad"),
      header: ({ column }) => <ColumnHeader column={column} title="可服务" />,
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
        <span
          className={cn(
            "tabular-nums",
            statIntentClass(rateIntent(row.original.success_rate)),
          )}
        >
          {formatPercent(row.original.success_rate)}
        </span>
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
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.bound_users}/{row.original.bound_keys}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      filterFn: facetedFilter,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
            <Link to={`/routes/${row.original.id}`}>
              <EyeIcon />
            </Link>
          </Button>
          <EditRouteAction row={row.original} />
        </div>
      ),
    },
  ];
}
