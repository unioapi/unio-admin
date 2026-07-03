import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type { RequestSummary } from "@/lib/api/requests";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";
import type { FacetOption } from "./types";

export const REQUEST_STATUS_OPTIONS: FacetOption[] = [
  { value: "succeeded", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "running", label: "进行中" },
  { value: "pending", label: "待处理" },
  { value: "canceled", label: "已取消" },
];

export const REQUEST_OS_COLUMN_LABELS: Record<string, string> = {
  request_id: "请求 ID",
  model: "模型",
  status: "状态",
  stream: "流式",
  user_id: "用户",
  created_at: "创建时间",
  action: "操作",
};

export function requestOsColumns(
  onOpenDetail: (requestId: string) => void,
): ColumnDef<RequestSummary, unknown>[] {
  return [
    {
      id: "request_id",
      accessorKey: "request_id",
      header: ({ column }) => <ColumnHeader column={column} title="请求 ID" />,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <TruncateCell className="font-mono text-xs" text={row.original.request_id} />
      ),
    },
    {
      id: "model",
      accessorKey: "requested_model_id",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      cell: ({ row }) => (
        <TruncateCell className="font-medium" text={row.original.requested_model_id} />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    },
    {
      id: "stream",
      accessorKey: "stream",
      header: ({ column }) => <ColumnHeader column={column} title="流式" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.stream ? "是" : "否"}</span>
      ),
    },
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.user_id}</span>
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="创建时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
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
