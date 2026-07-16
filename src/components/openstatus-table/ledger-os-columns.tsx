import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SquareArrowOutUpRightIcon } from "lucide-react";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";
import { formatDateTime, formatUSDPrecise, trimDecimal } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";
import type { FacetOption } from "./types";

// 账本页「流水」与「计费异常」Tab 的列定义（与 system-os-columns 同套约定）。
// 排序白名单：
//   流水：created_at / user_id / amount / entry_type
//   计费异常：created_at / user_id / event_type
// 其余列一律 enableSorting:false，避免发出后端不认的 sort 参数。

export const LEDGER_ENTRY_OS_COLUMN_LABELS: Record<string, string> = {
  user_id: "用户",
  entry_type: "类型",
  amount: "金额",
  balance_after: "余额",
  reason: "原因",
  created_at: "时间",
};

export const BILLING_EXCEPTION_OS_COLUMN_LABELS: Record<string, string> = {
  created_at: "时间",
  user_id: "用户",
  event_type: "类型",
  amounts: "金额",
  reason_code: "原因码",
  reservation_id: "预授权",
  reason: "原因",
  request_id: "请求",
};

// 计费异常类型：write_off=已确认核销；risk_exposure=风险敞口（未向用户扣费）。
const BILLING_EXCEPTION_EVENT_META: Record<
  string,
  { label: string; variant: "destructive" | "outline" | "secondary" }
> = {
  write_off: { label: "核销", variant: "destructive" },
  risk_exposure: { label: "风险敞口", variant: "outline" },
};

export const EVENT_TYPE_FILTER_OPTIONS = [
  { value: "write_off", label: "核销 write_off" },
  { value: "risk_exposure", label: "风险敞口 risk_exposure" },
] as const;

/** 筛选下拉：中文主标签 + 完整英文码，避免窄菜单截断看不清。 */
function reasonCodeOption(value: string, label: string): FacetOption {
  return {
    value,
    label,
    render: () => (
      <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
        <span>{label}</span>
        <span className="text-muted-foreground font-mono text-[11px] break-all">
          {value}
        </span>
      </span>
    ),
  };
}

// 原因码筛选：orphan_reservation_swept 即「孤儿预授权清扫」观测视图深链入口。
export const REASON_CODE_FILTER_OPTIONS: FacetOption[] = [
  reasonCodeOption("orphan_reservation_swept", "孤儿预授权清扫"),
  reasonCodeOption("settlement_recovery_exhausted", "补偿重试耗尽"),
  reasonCodeOption("authorization_underfunded", "授权额度不足核销"),
  reasonCodeOption("settlement_failed_after_upstream_success", "上游成功后结算失败"),
  reasonCodeOption(
    "stream_settlement_failed_after_upstream_success",
    "流式上游成功后结算失败",
  ),
  reasonCodeOption("upstream_cost_without_usage", "上游成本无 usage"),
  reasonCodeOption("responses_compact_missing_usage", "compact 缺 usage"),
];

export function billingExceptionEventLabel(eventType: string): string {
  return BILLING_EXCEPTION_EVENT_META[eventType]?.label ?? eventType;
}

const REASON_CODE_LABELS: Record<string, string> = Object.fromEntries(
  REASON_CODE_FILTER_OPTIONS.map((o) => [o.value, o.label]),
);

export function billingExceptionReasonCodeLabel(reasonCode: string): string {
  return REASON_CODE_LABELS[reasonCode] ?? reasonCode;
}

function billingExceptionReasonCodeShort(reasonCode: string): string {
  return REASON_CODE_LABELS[reasonCode] ?? reasonCode;
}

/** tip 内「标签 · 值」行，对齐请求中心 Field。 */
function TipField({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <span className="min-w-0 truncate text-right tabular-nums">{value}</span>
      </div>
      {hint ? (
        <p className="text-muted-foreground/80 text-[10px] leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

/** 单元格只显平台金额；明细用请求中心同款 HoverCard tip。 */
function exceptionAmountsCell(row: BillingException) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default py-0.5 text-left font-medium tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
        >
          {formatUSDPrecise(row.platform_amount)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex flex-col gap-2 text-xs">
          <div className="text-sm font-medium">金额明细</div>
          <div className="flex flex-col gap-2">
            <TipField
              label="平台"
              value={formatUSDPrecise(row.platform_amount)}
              hint={
                row.event_type === "write_off"
                  ? "核销：平台承担的差额（真实成本 − 用户实收）。"
                  : "风险敞口：风险上限，不等于已确认亏损。"
              }
            />
            <TipField
              label="实收"
              value={formatUSDPrecise(row.captured_amount)}
              hint="向用户实扣的金额。"
            />
            <TipField
              label="成本"
              value={formatUSDPrecise(row.actual_amount)}
              hint="真实上游成本；风险敞口时通常为空。"
            />
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

/** 用户列：第一行用户名 + #id，第二行邮箱（对齐用户列表「用户名/ID」）。 */
function ledgerUserCell(user: {
  user_id: number;
  user_display_name?: string;
  user_email?: string;
}) {
  const name = user.user_display_name?.trim() || "—";
  const email = user.user_email?.trim() || "—";
  const idLabel = `#${user.user_id}`;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div className="min-w-0 cursor-default">
          <TruncateCell
            text={
              <>
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground tabular-nums"> {idLabel}</span>
              </>
            }
            subtext={email}
            title=""
          />
        </div>
      </TooltipTrigger>
      <TooltipContent align="start" className="max-w-md break-all">
        <div>
          {name} <span className="text-background/70 tabular-nums">{idLabel}</span>
        </div>
        <div className="text-background/70">{email}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ledgerEntryOsColumns(): ColumnDef<LedgerEntry, unknown>[] {
  return [
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      enableHiding: false,
      size: 160,
      meta: {
        autoSizeValue: (row: LedgerEntry) =>
          `${row.user_display_name || "—"} #${row.user_id}`,
      },
      cell: ({ row }) => ledgerUserCell(row.original),
    },
    {
      id: "entry_type",
      accessorKey: "entry_type",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      size: 112,
      cell: ({ row }) => <Badge variant="secondary">{row.original.entry_type}</Badge>,
    },
    {
      id: "amount",
      accessorFn: (r) => Number(r.amount),
      header: ({ column }) => <ColumnHeader column={column} title="金额" />,
      size: 120,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {trimDecimal(row.original.amount)} {row.original.currency}
        </span>
      ),
    },
    {
      id: "balance_after",
      accessorFn: (r) => Number(r.balance_after),
      header: ({ column }) => <ColumnHeader column={column} title="余额" />,
      enableSorting: false,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {trimDecimal(row.original.balance_after)}
        </span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => <ColumnHeader column={column} title="原因" />,
      enableSorting: false,
      size: 220,
      cell: ({ row }) => (
        <TruncateCell className="text-muted-foreground" text={row.original.reason} />
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      size: 148,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
  ];
}

export function billingExceptionOsColumns(): ColumnDef<BillingException, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      enableHiding: false,
      size: 148,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "user_id",
      accessorKey: "user_id",
      header: ({ column }) => <ColumnHeader column={column} title="用户" />,
      size: 160,
      meta: {
        autoSizeValue: (row: BillingException) =>
          `${row.user_display_name || "—"} #${row.user_id}`,
      },
      cell: ({ row }) => ledgerUserCell(row.original),
    },
    {
      id: "event_type",
      accessorKey: "event_type",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      size: 96,
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
      id: "amounts",
      accessorFn: (r) => Number(r.platform_amount),
      header: ({ column }) => <ColumnHeader column={column} title="金额" />,
      enableSorting: false,
      size: 100,
      cell: ({ row }) => exceptionAmountsCell(row.original),
    },
    {
      id: "reason_code",
      accessorKey: "reason_code",
      header: ({ column }) => <ColumnHeader column={column} title="原因码" />,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const code = row.original.reason_code;
        const short = billingExceptionReasonCodeShort(code);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="min-w-0 cursor-default">
                <TruncateCell className="text-muted-foreground" text={short} title="" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">{code}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "reservation_id",
      accessorKey: "reservation_id",
      header: ({ column }) => <ColumnHeader column={column} title="预授权" />,
      enableSorting: false,
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.reservation_id}</span>
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => <ColumnHeader column={column} title="原因" />,
      enableSorting: false,
      size: 220,
      cell: ({ row }) => (
        <TruncateCell className="text-muted-foreground" text={row.original.reason} />
      ),
    },
    {
      id: "request_id",
      accessorKey: "request_id",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      enableSorting: false,
      size: 160,
      cell: ({ row }) => {
        const requestId = row.original.request_id;
        if (!requestId) {
          return (
            <span className="text-muted-foreground tabular-nums">
              #{row.original.request_record_id}
            </span>
          );
        }
        return (
          <div className="flex min-w-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <TruncateCell className="font-mono text-xs" text={requestId} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="查看对应请求记录" asChild>
                  <Link to={`/requests?request_id=${encodeURIComponent(requestId)}`}>
                    <SquareArrowOutUpRightIcon />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>查看对应请求记录</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];
}
