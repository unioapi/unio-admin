import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type { RequestListItem } from "@/lib/api/requests";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import {
  RequestCostCell,
  RequestIdCell,
  RequestModelCell,
  RequestReasoningCell,
  RequestRouteCell,
  RequestTimingCell,
  RequestTokensCell,
  RequestUserKeyCell,
} from "@/components/requests/request-cells";
import type { FacetOption } from "./types";

export const REQUEST_STATUS_OPTIONS: FacetOption[] = [
  { value: "succeeded", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "running", label: "进行中" },
  { value: "pending", label: "待处理" },
  { value: "canceled", label: "已取消" },
];

export const REQUEST_OS_COLUMN_LABELS: Record<string, string> = {
  created_at: "时间",
  status: "状态",
  user_id: "用户/Key",
  route: "线路",
  model: "模型",
  reasoning: "推理强度",
  stream: "类型",
  endpoint: "端点",
  ip: "IP",
  timing: "耗时",
  tokens: "Tokens",
  cost: "费用",
  request_id: "请求 ID",
  action: "操作",
};

// 端点显示：优先 endpoint（chat_completions/messages/responses），回退 ingress_protocol。
function endpointLabel(row: RequestListItem): string {
  return row.endpoint || row.ingress_protocol || "—";
}

export function requestOsColumns(
  onOpenDetail: (requestId: string) => void,
): ColumnDef<RequestListItem, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="时间" />
      ),
      enableHiding: false,
      enableColumnFilter: true,
      meta: {
        label: "时间",
        variant: "dateRange",
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums text-xs">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="状态" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "状态",
        variant: "select",
        options: REQUEST_STATUS_OPTIONS,
      },
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    },
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="用户/Key" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "用户 ID",
        variant: "text",
        placeholder: "用户 ID",
      },
      cell: ({ row }) => <RequestUserKeyCell row={row.original} />,
    },
    {
      id: "route",
      accessorKey: "route_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="线路" />
      ),
      enableSorting: false,
      meta: { label: "线路" },
      cell: ({ row }) => <RequestRouteCell row={row.original} />,
    },
    {
      id: "model",
      accessorKey: "requested_model_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="模型" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "模型",
        variant: "text",
        placeholder: "按模型筛选",
      },
      cell: ({ row }) => <RequestModelCell row={row.original} />,
    },
    {
      id: "reasoning",
      accessorKey: "reasoning_effort",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="推理强度" />
      ),
      enableSorting: false,
      meta: { label: "推理强度" },
      cell: ({ row }) => <RequestReasoningCell row={row.original} />,
    },
    {
      id: "stream",
      accessorKey: "stream",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="类型" />
      ),
      enableSorting: false,
      meta: { label: "类型" },
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.stream ? "流式" : "非流式"}
        </span>
      ),
    },
    {
      id: "endpoint",
      accessorFn: (r) => endpointLabel(r),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="端点" />
      ),
      enableSorting: false,
      meta: { label: "端点" },
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-[11px]">
          {endpointLabel(row.original)}
        </span>
      ),
    },
    {
      id: "ip",
      accessorKey: "client_ip",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="IP" />
      ),
      enableSorting: false,
      meta: { label: "IP" },
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-[11px]">
          {row.original.client_ip || "—"}
        </span>
      ),
    },
    {
      id: "timing",
      header: () => <span className="text-muted-foreground">耗时</span>,
      enableSorting: false,
      meta: { label: "耗时" },
      cell: ({ row }) => <RequestTimingCell row={row.original} />,
    },
    {
      id: "tokens",
      header: () => <span className="text-muted-foreground">Tokens</span>,
      enableSorting: false,
      meta: { label: "Tokens" },
      cell: ({ row }) => <RequestTokensCell row={row.original} />,
    },
    {
      id: "cost",
      header: () => <span className="text-muted-foreground">费用</span>,
      enableSorting: false,
      meta: { label: "费用" },
      cell: ({ row }) => <RequestCostCell row={row.original} />,
    },
    {
      id: "request_id",
      accessorKey: "request_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="请求 ID" />
      ),
      enableSorting: false,
      meta: { label: "请求 ID" },
      cell: ({ row }) => <RequestIdCell row={row.original} />,
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "操作" },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="详情"
            onClick={() => onOpenDetail(row.original.request_id)}
          >
            <EyeIcon />
          </Button>
        </div>
      ),
    },
  ];
}
