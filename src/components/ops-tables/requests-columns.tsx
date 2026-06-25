import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type { RequestSummary } from "@/lib/api/requests";
import { resizableColumn } from "@/components/data-table";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";

export function requestListColumns(): ColumnDef<RequestSummary, unknown>[] {
  return [
    resizableColumn<RequestSummary>("request_id", {
      header: "请求 ID",
      size: 180,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="truncate font-mono text-xs">{row.original.request_id}</span>
      ),
    }),
    resizableColumn<RequestSummary>("requested_model_id", {
      header: "模型",
      size: 180,
      cell: ({ row }) => <span className="font-medium">{row.original.requested_model_id}</span>,
    }),
    resizableColumn<RequestSummary>("status", {
      header: "状态",
      size: 96,
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    }),
    resizableColumn<RequestSummary>("stream", {
      header: "流式",
      size: 72,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.stream ? "是" : "否"}</span>
      ),
    }),
    resizableColumn<RequestSummary>("user_id", {
      header: "用户",
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.user_id}</span>
      ),
    }),
    resizableColumn<RequestSummary>("created_at", {
      header: "创建时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    }),
    resizableColumn<RequestSummary>("action", {
      header: "操作",
      size: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <div  onClick={(e) => e.stopPropagation()}>
          <RequestDetailDialog requestId={row.original.request_id}>
            <Button variant="ghost" size="icon-sm" aria-label="详情">
              <EyeIcon />
            </Button>
          </RequestDetailDialog>
        </div>
      ),
    }),
  ];
}
