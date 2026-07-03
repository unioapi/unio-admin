import type { ColumnDef } from "@tanstack/react-table";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";
import { ColumnHeader, TruncateCell } from "@/components/openstatus-table";
import { formatDateTime, trimDecimal } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

// 计费异常类型的本地化展示：
//   write_off    = 平台已确认承担的核销（实收 < 真实成本的差额，资金已记账）→ 强提示(destructive)。
//   risk_exposure = 风险敞口（上游可能已产生成本但无可靠 usage、未向用户扣费）→ 弱提示(outline)。
// 两者审计语义不同，必须可区分、可筛选（P0 前端）。
const BILLING_EXCEPTION_EVENT_META: Record<
  string,
  { label: string; variant: "destructive" | "outline" | "secondary" }
> = {
  write_off: { label: "核销 write_off", variant: "destructive" },
  risk_exposure: { label: "风险敞口 risk_exposure", variant: "outline" },
};

// EVENT_TYPE_FILTER_OPTIONS 供 Ledger 计费异常页的类型筛选使用。
export const EVENT_TYPE_FILTER_OPTIONS = [
  { value: "write_off", label: "核销 write_off" },
  { value: "risk_exposure", label: "风险敞口 risk_exposure" },
] as const;

// REASON_CODE_FILTER_OPTIONS 供 Ledger 计费异常页按「原因码」聚焦观测特定治理路径。
// 第一项 orphan_reservation_swept 即「孤儿预授权清扫」观测视图：进程崩溃遗留的 authorized 预授权
// 被清扫 worker 释放并记一条 risk_exposure 敞口（P1-5/P1 前端）。其余为常见治理原因码，便于运营聚合排查。
export const REASON_CODE_FILTER_OPTIONS = [
  { value: "orphan_reservation_swept", label: "孤儿预授权清扫 orphan_reservation_swept" },
  { value: "settlement_recovery_exhausted", label: "补偿重试耗尽 settlement_recovery_exhausted" },
  { value: "authorization_underfunded", label: "授权额度不足核销 authorization_underfunded" },
  {
    value: "settlement_failed_after_upstream_success",
    label: "上游成功后结算失败 settlement_failed_after_upstream_success",
  },
  {
    value: "stream_settlement_failed_after_upstream_success",
    label: "流式上游成功后结算失败 stream_settlement_failed_after_upstream_success",
  },
  { value: "upstream_cost_without_usage", label: "上游成本无 usage upstream_cost_without_usage" },
  { value: "responses_compact_missing_usage", label: "compact 缺 usage responses_compact_missing_usage" },
] as const;

export function billingExceptionEventLabel(eventType: string): string {
  return BILLING_EXCEPTION_EVENT_META[eventType]?.label ?? eventType;
}

const REASON_CODE_LABELS: Record<string, string> = Object.fromEntries(
  REASON_CODE_FILTER_OPTIONS.map((o) => [o.value, o.label]),
);

export function billingExceptionReasonCodeLabel(reasonCode: string): string {
  return REASON_CODE_LABELS[reasonCode] ?? reasonCode;
}

export function ledgerEntryColumns(): ColumnDef<LedgerEntry, unknown>[] {
  return [
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.user_id}</span>
      ),
    },
    {
      id: "entry_type",
      accessorKey: "entry_type",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.entry_type}</Badge>,
    },
    {
      id: "amount",
      accessorFn: (r) => Number(r.amount),
      header: ({ column }) => <ColumnHeader column={column} title="金额" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {trimDecimal(row.original.amount)} {row.original.currency}
        </span>
      ),
    },
    {
      id: "balance_after",
      accessorFn: (r) => Number(r.balance_after),
      header: ({ column }) => <ColumnHeader column={column} title="余额" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{trimDecimal(row.original.balance_after)}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => <ColumnHeader column={column} title="原因" />,
      cell: ({ row }) => (
        <TruncateCell className="text-muted-foreground" text={row.original.reason} />
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
  ];
}

export function billingExceptionColumns(): ColumnDef<BillingException, unknown>[] {
  return [
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.user_id}</span>
      ),
    },
    {
      id: "event_type",
      accessorKey: "event_type",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      cell: ({ row }) => {
        const meta = BILLING_EXCEPTION_EVENT_META[row.original.event_type];
        return (
          <Badge variant={meta?.variant ?? "destructive"}>
            {meta?.label ?? row.original.event_type}
          </Badge>
        );
      },
    },
    {
      id: "platform_amount",
      accessorFn: (r) => Number(r.platform_amount),
      header: ({ column }) => <ColumnHeader column={column} title="平台承担" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {trimDecimal(row.original.platform_amount)} {row.original.currency}
        </span>
      ),
    },
    {
      id: "reason_code",
      accessorKey: "reason_code",
      header: ({ column }) => <ColumnHeader column={column} title="原因码" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reason_code}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => <ColumnHeader column={column} title="原因" />,
      cell: ({ row }) => (
        <TruncateCell className="text-muted-foreground" text={row.original.reason} />
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
  ];
}
