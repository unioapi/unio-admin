import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import type {
  RouteOpsBoundKey,
  RouteOpsChannelPoolItem,
  RouteOpsModel,
  RouteOpsRequest,
} from "@/lib/api/routesOps";
import { resizableColumn } from "@/components/data-table";
import { requestIdLinkColumn } from "./shared-columns";
import { formatChartTs, formatCompact, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";

export const ROUTE_OPS_POOL_COLUMN_LABELS: Record<string, string> = {
  channel: "渠道",
  provider_name: "服务商",
  channel_status: "状态",
  priority: "优先级",
  action: "操作",
};

export const ROUTE_OPS_MODEL_COLUMN_LABELS: Record<string, string> = {
  model_id: "模型",
  request_total: "请求",
  success_rate: "成功率",
};

export const ROUTE_OPS_KEY_COLUMN_LABELS: Record<string, string> = {
  name: "Key",
  status: "状态",
};

export const ROUTE_OPS_REQUEST_COLUMN_LABELS: Record<string, string> = {
  at: "时间",
  model_id: "模型",
  status: "状态",
  request_id: "请求",
};

export function routeOpsPoolColumns(): ColumnDef<RouteOpsChannelPoolItem, unknown>[] {
  return [
    resizableColumn<RouteOpsChannelPoolItem>("channel", {
      header: "渠道",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.channel_name}</span>
      ),
    }),
    resizableColumn<RouteOpsChannelPoolItem>("provider_name", {
      header: "服务商",
      size: 140,
      minSize: 100,
      cell: ({ row }) => <span className="text-xs">{row.original.provider_name}</span>,
    }),
    resizableColumn<RouteOpsChannelPoolItem>("channel_status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => (
        <StatusBadge status={row.original.channel_status} />
      ),
    }),
    resizableColumn<RouteOpsChannelPoolItem>("priority", {
      header: "优先级",
      size: 88,
      minSize: 64,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.priority}</span>
      ),
    }),
    resizableColumn<RouteOpsChannelPoolItem>("action", {
      header: "操作",
      size: 80,
      minSize: 64,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/channels/${row.original.channel_id}`}>打开</Link>
        </Button>
      ),
    }),
  ];
}

export function routeOpsModelColumns(): ColumnDef<RouteOpsModel, unknown>[] {
  return [
    resizableColumn<RouteOpsModel>("model_id", {
      header: "模型",
      size: 240,
      minSize: 160,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.model_id}</span>
      ),
    }),
    resizableColumn<RouteOpsModel>("request_total", {
      header: "请求",
      size: 96,
      minSize: 72,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatCompact(row.original.request_total)}</span>
      ),
    }),
    resizableColumn<RouteOpsModel>("success_rate", {
      header: "成功率",
      size: 96,
      minSize: 80,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatPercent(row.original.success_rate)}</span>
      ),
    }),
  ];
}

export function routeOpsKeyColumns(): ColumnDef<RouteOpsBoundKey, unknown>[] {
  return [
    resizableColumn<RouteOpsBoundKey>("name", {
      header: "Key",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => <span className="text-sm">{row.original.name}</span>,
    }),
    resizableColumn<RouteOpsBoundKey>("status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "outline"}>
          {row.original.status}
        </Badge>
      ),
    }),
  ];
}

export function routeOpsRequestColumns(): ColumnDef<RouteOpsRequest, unknown>[] {
  return [
    resizableColumn<RouteOpsRequest>("at", {
      header: "时间",
      size: 112,
      minSize: 88,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatChartTs(row.original.at)}</span>
      ),
    }),
    resizableColumn<RouteOpsRequest>("model_id", {
      header: "模型",
      size: 160,
      minSize: 120,
      cell: ({ row }) => <span className="text-xs">{row.original.model_id}</span>,
    }),
    resizableColumn<RouteOpsRequest>("status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => <span className="text-xs">{row.original.status}</span>,
    }),
    requestIdLinkColumn<RouteOpsRequest>(),
  ];
}
