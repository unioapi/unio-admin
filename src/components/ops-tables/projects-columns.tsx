import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import type { ProjectOpsRow } from "@/lib/api/customerOps";
import { resizableColumn } from "@/components/data-table";
import { formatCompact, formatRelativeTime, formatUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function projectOpsColumns(): ColumnDef<ProjectOpsRow, unknown>[] {
  return [
    resizableColumn<ProjectOpsRow>("name", {
      header: "项目",
      size: 160,
      minSize: 120,
      enableHiding: false,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    }),
    resizableColumn<ProjectOpsRow>("user_email", {
      header: "所属用户",
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{row.original.user_email}</span>
      ),
    }),
    resizableColumn<ProjectOpsRow>("default_route_name", {
      header: "默认线路",
      size: 140,
      cell: ({ row }) => (
        <span className="text-xs">{row.original.default_route_name || "由 Key 决定"}</span>
      ),
    }),
    resizableColumn<ProjectOpsRow>("keys", {
      header: "Key",
      size: 80,
      cell: ({ row }) => `${row.original.key_enabled}/${row.original.key_total}`,
    }),
    resizableColumn<ProjectOpsRow>("request_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.request_total),
    }),
    resizableColumn<ProjectOpsRow>("consumption_usd", {
      header: "消费",
      size: 112,
      cell: ({ row }) => formatUSD(row.original.consumption_usd),
    }),
    resizableColumn<ProjectOpsRow>("last_used_at", {
      header: "最近",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_used_at ? formatRelativeTime(row.original.last_used_at) : "—"}
        </span>
      ),
    }),
    resizableColumn<ProjectOpsRow>("action", {
      header: "操作",
      size: 88,
      enableHiding: false,
      cell: ({ row }) => (
        <div  onClick={(e) => e.stopPropagation()}>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/projects/${row.original.id}/api-keys`}>API Keys</Link>
          </Button>
        </div>
      ),
    }),
  ];
}
