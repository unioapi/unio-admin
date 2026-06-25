import type { ColumnDef } from "@tanstack/react-table";
import type { UserOpsRow } from "@/lib/api/customerOps";
import { resizableColumn } from "@/components/data-table";
import { formatCompact, formatRelativeTime, formatUSD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function userOpsColumns(): ColumnDef<UserOpsRow, unknown>[] {
  return [
    resizableColumn<UserOpsRow>("name", {
      header: "用户",
      size: 220,
      minSize: 160,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.email}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.display_name}</div>
        </>
      ),
    }),
    resizableColumn<UserOpsRow>("balance_usd", {
      header: "余额",
      size: 112,
      cell: ({ row }) => formatUSD(row.original.balance_usd),
    }),
    resizableColumn<UserOpsRow>("available_usd", {
      header: "可用",
      size: 112,
      cell: ({ row }) => formatUSD(row.original.available_usd),
    }),
    resizableColumn<UserOpsRow>("project_count", {
      header: "项目",
      size: 80,
      cell: ({ row }) => row.original.project_count,
    }),
    resizableColumn<UserOpsRow>("key_total", {
      header: "Key",
      size: 72,
      cell: ({ row }) => row.original.key_total,
    }),
    resizableColumn<UserOpsRow>("request_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.request_total),
    }),
    resizableColumn<UserOpsRow>("consumption_usd", {
      header: "消费",
      size: 112,
      cell: ({ row }) => formatUSD(row.original.consumption_usd),
    }),
    resizableColumn<UserOpsRow>("last_used_at", {
      header: "最近",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_used_at ? formatRelativeTime(row.original.last_used_at) : "—"}
        </span>
      ),
    }),
    resizableColumn<UserOpsRow>("risk", {
      header: "风险",
      size: 88,
      cell: ({ row }) =>
        row.original.low_balance ? (
          <Badge variant="secondary">低余额</Badge>
        ) : (
          <Badge variant="outline">正常</Badge>
        ),
    }),
  ];
}
