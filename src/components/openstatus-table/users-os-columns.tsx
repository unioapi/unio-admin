/* eslint-disable react-refresh/only-export-components */
import type { ColumnDef } from "@tanstack/react-table";
import type { UserOpsRow } from "@/lib/api/customerOps";
import { UserRowActions } from "@/components/customer/UserRowActions";
import { formatDateTime, formatInt, formatRelativeTime, formatUSD } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

export const USER_OS_COLUMN_LABELS: Record<string, string> = {
  display_name: "用户名/ID",
  email: "邮箱",
  keys: "API Key",
  balance: "余额",
  total_consumption: "累计消费",
  total_topup: "累计充值",
  last_used: "最近使用",
  created_at: "注册时间",
  action: "操作",
};

export function userOsColumns(): ColumnDef<UserOpsRow, unknown>[] {
  return [
    {
      id: "display_name",
      accessorKey: "display_name",
      header: ({ column }) => <ColumnHeader column={column} title="用户名/ID" />,
      enableHiding: false,
      meta: {
        autoSizeValue: (row: UserOpsRow) =>
          `${row.display_name || "—"} #${row.id}`,
      },
      cell: ({ row }) => {
        const { display_name, id } = row.original;
        const label = display_name || "—";
        return (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div className="min-w-0 cursor-default">
                <TruncateCell
                  text={label}
                  subtext={`#${id}`}
                  className="font-medium"
                  title=""
                />
              </div>
            </TooltipTrigger>
            <TooltipContent align="start" className="max-w-md break-all">
              <div>{label}</div>
              <div className="text-background/70 tabular-nums">ID {id}</div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "email",
      accessorKey: "email",
      header: ({ column }) => <ColumnHeader column={column} title="邮箱" />,
      meta: { autoSizeValue: (row: UserOpsRow) => row.email },
      cell: ({ row }) => {
        const email = row.original.email;
        return (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div className="min-w-0 cursor-default">
                <TruncateCell text={email} className="text-sm" title="" />
              </div>
            </TooltipTrigger>
            <TooltipContent align="start" className="max-w-md break-all">
              {email}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "keys",
      accessorKey: "key_total",
      header: ({ column }) => <ColumnHeader column={column} title="API Key" />,
      meta: {
        autoSizeValue: (row: UserOpsRow) => formatInt(row.key_total),
      },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatInt(row.original.key_total)}</span>
      ),
    },
    {
      id: "balance",
      accessorFn: (r) => Number(r.balance_usd),
      header: ({ column }) => <ColumnHeader column={column} title="余额" />,
      meta: { autoSizeValue: (row: UserOpsRow) => formatUSD(row.balance_usd) },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatUSD(row.original.balance_usd)}</span>
      ),
    },
    {
      id: "total_consumption",
      accessorFn: (r) => Number(r.total_consumption_usd),
      header: ({ column }) => <ColumnHeader column={column} title="累计消费" />,
      meta: {
        autoSizeValue: (row: UserOpsRow) => formatUSD(row.total_consumption_usd),
      },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatUSD(row.original.total_consumption_usd)}</span>
      ),
    },
    {
      id: "total_topup",
      accessorFn: (r) => Number(r.total_topup_usd),
      header: ({ column }) => <ColumnHeader column={column} title="累计充值" />,
      meta: {
        autoSizeValue: (row: UserOpsRow) => formatUSD(row.total_topup_usd),
      },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatUSD(row.original.total_topup_usd)}</span>
      ),
    },
    {
      id: "last_used",
      accessorFn: (r) => r.last_used_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="最近使用" />,
      meta: {
        autoSizeValue: (row: UserOpsRow) =>
          row.last_used_at ? formatRelativeTime(row.last_used_at) : "—",
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.original.last_used_at
            ? formatRelativeTime(row.original.last_used_at)
            : "—"}
        </span>
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="注册时间" />,
      meta: {
        autoSizeValue: (row: UserOpsRow) => formatDateTime(row.created_at),
      },
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
      cell: ({ row }) => <UserRowActions row={row.original} />,
    },
  ];
}
