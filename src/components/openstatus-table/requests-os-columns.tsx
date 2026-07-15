import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type { RequestListItem } from "@/lib/api/requests";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { ColumnHeader } from "./column-header";
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
  model: "模型",
  stream: "类型",
  endpoint: "端点",
  ip: "IP",
  route: "线路",
  reasoning: "推理强度",
  timing: "耗时",
  tokens: "Tokens",
  cost: "费用",
  request_id: "请求 ID",
  action: "操作",
};

// 端点显示：优先 operation（chat_completions/messages/responses），回退 ingress_protocol。
function endpointLabel(row: RequestListItem): string {
  return row.operation || row.ingress_protocol || "—";
}

export function requestOsColumns(
  onOpenDetail: (requestId: string) => void,
): ColumnDef<RequestListItem, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums text-xs">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    },
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户/Key" />,
      cell: ({ row }) => <RequestUserKeyCell row={row.original} />,
    },
    {
      id: "model",
      accessorKey: "requested_model_id",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      cell: ({ row }) => <RequestModelCell row={row.original} />,
    },
    {
      id: "stream",
      accessorKey: "stream",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.stream ? "流式" : "非流式"}
        </span>
      ),
    },
    {
      id: "endpoint",
      accessorFn: (r) => endpointLabel(r),
      header: ({ column }) => <ColumnHeader column={column} title="端点" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-[11px]">
          {endpointLabel(row.original)}
        </span>
      ),
    },
    {
      id: "ip",
      accessorKey: "client_ip",
      header: ({ column }) => <ColumnHeader column={column} title="IP" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-[11px]">
          {row.original.client_ip || "—"}
        </span>
      ),
    },
    {
      id: "route",
      accessorKey: "route_name",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      enableSorting: false,
      cell: ({ row }) => <RequestRouteCell row={row.original} />,
    },
    {
      id: "reasoning",
      accessorKey: "reasoning_effort",
      header: ({ column }) => <ColumnHeader column={column} title="推理强度" />,
      enableSorting: false,
      cell: ({ row }) => <RequestReasoningCell row={row.original} />,
    },
    {
      id: "timing",
      header: () => <span className="text-muted-foreground">耗时</span>,
      enableSorting: false,
      cell: ({ row }) => <RequestTimingCell row={row.original} />,
    },
    {
      id: "tokens",
      header: () => <span className="text-muted-foreground">Tokens</span>,
      enableSorting: false,
      cell: ({ row }) => <RequestTokensCell row={row.original} />,
    },
    {
      id: "cost",
      header: () => <span className="text-muted-foreground">费用</span>,
      enableSorting: false,
      cell: ({ row }) => <RequestCostCell row={row.original} />,
    },
    {
      id: "request_id",
      accessorKey: "request_id",
      header: ({ column }) => <ColumnHeader column={column} title="请求 ID" />,
      enableSorting: false,
      cell: ({ row }) => <RequestIdCell row={row.original} />,
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableSorting: false,
      enableHiding: false,
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
