import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { UserOpsRow } from "@/lib/api/customerOps";
import { formatCompact, formatRelativeTime, formatUSD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

const facetedFilter: FilterFn<UserOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const USER_OS_COLUMN_LABELS: Record<string, string> = {
  email: "用户",
  balance: "余额",
  available: "可用",
  keys: "Key",
  requests: "请求",
  consumption: "消费",
  last_used: "最近",
  risk: "风险",
  action: "操作",
};

export function userOsColumns(): ColumnDef<UserOpsRow, unknown>[] {
  return [
    {
      id: "email",
      accessorKey: "email",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.email}
          className="font-medium"
          subtext={row.original.display_name}
        />
      ),
    },
    {
      id: "balance",
      accessorFn: (r) => Number(r.balance_usd),
      header: ({ column }) => <ColumnHeader column={column} title="余额" />,
      cell: ({ row }) => <span className="tabular-nums">{formatUSD(row.original.balance_usd)}</span>,
    },
    {
      id: "available",
      accessorFn: (r) => Number(r.available_usd),
      header: ({ column }) => <ColumnHeader column={column} title="可用" />,
      cell: ({ row }) => <span className="tabular-nums">{formatUSD(row.original.available_usd)}</span>,
    },
    {
      id: "keys",
      accessorKey: "key_total",
      header: ({ column }) => <ColumnHeader column={column} title="Key" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.key_total}</span>,
    },
    {
      id: "requests",
      accessorKey: "request_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => <span className="tabular-nums">{formatCompact(row.original.request_total)}</span>,
    },
    {
      id: "consumption",
      accessorFn: (r) => Number(r.consumption_usd),
      header: ({ column }) => <ColumnHeader column={column} title="消费" />,
      cell: ({ row }) => <span className="tabular-nums">{formatUSD(row.original.consumption_usd)}</span>,
    },
    {
      id: "last_used",
      accessorFn: (r) => r.last_used_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="最近" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.original.last_used_at ? formatRelativeTime(row.original.last_used_at) : "—"}
        </span>
      ),
    },
    {
      id: "risk",
      accessorFn: (r) => (r.low_balance ? "low" : "ok"),
      header: ({ column }) => <ColumnHeader column={column} title="风险" />,
      filterFn: facetedFilter,
      cell: ({ row }) =>
        row.original.low_balance ? (
          <Badge variant="secondary">低余额</Badge>
        ) : (
          <Badge variant="outline">正常</Badge>
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
            <Link to={`/users/${row.original.id}`}>
              <EyeIcon />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
