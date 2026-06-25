import type { ColumnDef } from "@tanstack/react-table";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";
import { resizableColumn } from "@/components/data-table";
import { formatDateTime, trimDecimal } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function ledgerEntryColumns(): ColumnDef<LedgerEntry, unknown>[] {
  return [
    resizableColumn<LedgerEntry>("user_id", {
      header: "用户",
      size: 80,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.user_id}</span>
      ),
    }),
    resizableColumn<LedgerEntry>("entry_type", {
      header: "类型",
      size: 96,
      cell: ({ row }) => <Badge variant="secondary">{row.original.entry_type}</Badge>,
    }),
    resizableColumn<LedgerEntry>("amount", {
      header: "金额",
      size: 128,
      cell: ({ row }) => (
        <span className="font-medium">
          {trimDecimal(row.original.amount)} {row.original.currency}
        </span>
      ),
    }),
    resizableColumn<LedgerEntry>("balance_after", {
      header: "余额",
      size: 128,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{trimDecimal(row.original.balance_after)}</span>
      ),
    }),
    resizableColumn<LedgerEntry>("reason", {
      header: "原因",
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate">{row.original.reason}</span>
      ),
    }),
    resizableColumn<LedgerEntry>("created_at", {
      header: "时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    }),
  ];
}

export function billingExceptionColumns(): ColumnDef<BillingException, unknown>[] {
  return [
    resizableColumn<BillingException>("user_id", {
      header: "用户",
      size: 80,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.user_id}</span>
      ),
    }),
    resizableColumn<BillingException>("event_type", {
      header: "类型",
      size: 120,
      cell: ({ row }) => <Badge variant="destructive">{row.original.event_type}</Badge>,
    }),
    resizableColumn<BillingException>("platform_amount", {
      header: "平台承担",
      size: 128,
      cell: ({ row }) => (
        <span className="font-medium">
          {trimDecimal(row.original.platform_amount)} {row.original.currency}
        </span>
      ),
    }),
    resizableColumn<BillingException>("reason_code", {
      header: "原因码",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reason_code}</span>
      ),
    }),
    resizableColumn<BillingException>("reason", {
      header: "原因",
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate">{row.original.reason}</span>
      ),
    }),
    resizableColumn<BillingException>("created_at", {
      header: "时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    }),
  ];
}
