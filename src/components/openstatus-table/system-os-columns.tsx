import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { EyeIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import type { SyncJob } from "@/lib/api/capability";
import type { RecoveryJobSummary } from "@/lib/api/system";
import { formatDateTime, formatUSDPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RecoveryStatusBadge } from "@/components/system/RecoveryStatusBadge";
import { RecoveryJobDetailDialog } from "@/components/system/RecoveryJobDetailDialog";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

// 结算补偿任务（账本页「结算补偿」Tab）与模型目录同步任务（参考目录页「同步记录」Tab）的列定义。
// 注意：排序是服务端驱动，补偿任务后端白名单仅 created_at / status / user_id——
// 其余列一律 enableSorting:false，避免发出后端不认的 sort 参数。

export const RECOVERY_OS_COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  status: "状态",
  model: "模型",
  user_channel: "用户 / 渠道",
  attempts: "重试",
  amounts: "冻结",
  settlement: "实扣/释放",
  last_error: "最近错误",
  next_run_at: "下次执行",
  completed_at: "完成时间",
  created_at: "创建时间",
  action: "操作",
};

export const SYNC_OS_COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  source: "来源",
  status: "状态",
  created_at: "创建时间",
  finished_at: "结束时间",
};

export const RECOVERY_STATUS_OPTIONS = [
  { value: "pending", label: "待执行" },
  { value: "running", label: "运行中" },
  { value: "succeeded", label: "已完成" },
  { value: "dead", label: "已死信" },
] as const;

function syncStatusBadge(status: string) {
  if (status === "succeeded") return <Badge variant="default">成功</Badge>;
  if (status === "running") return <Badge variant="secondary">运行中</Badge>;
  if (status === "failed") return <Badge variant="destructive">失败</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

type MoneyTone = "strong" | "muted" | "warn" | "positive";

const MONEY_TONE: Record<MoneyTone, string> = {
  strong: "text-foreground font-medium",
  muted: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  positive: "text-emerald-600 dark:text-emerald-400",
};

/**
 * 金额行：左侧极小灰标签,右侧对齐的货币值。多行叠放时数值右对齐、标签左对齐,
 * 形成清爽的「键—值」小账单,替代此前拼字符串+截断的粗糙展示。
 * 用工厂函数而非组件,避免与列定义同文件触发 react-refresh 限制。
 */
function moneyLine(label: string, value: string, tone: MoneyTone = "muted") {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground shrink-0 text-[10px]">{label}</span>
      <span className={cn("truncate text-xs tabular-nums", MONEY_TONE[tone])}>{value}</span>
    </div>
  );
}

/**
 * 资金闭环列渲染：实扣(含加扣) + 释放。
 * 语义随预授权状态：authorized=未结算(冻结在途)；captured=已实扣,差额已释放,超冻结部分为「加扣」；
 * released=已全额释放(dead 收口,未向用户扣费,平台承担见计费异常)。
 */
function recoverySettlementCell(row: RecoveryJobSummary) {
  const status = row.reservation_status;
  if (!status || status === "authorized") {
    return <span className="text-muted-foreground text-xs">未结算</span>;
  }
  const overage = Number(row.overage_amount) > 0;
  const captured = status === "released" ? "0" : row.captured_amount;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {moneyLine("实扣", formatUSDPrecise(captured), "strong")}
      {overage ? moneyLine("加扣", `+${formatUSDPrecise(row.overage_amount)}`, "warn") : null}
      {moneyLine("释放", formatUSDPrecise(row.released_amount), "positive")}
    </div>
  );
}

export function recoveryJobOsColumns(): ColumnDef<RecoveryJobSummary, unknown>[] {
  return [
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      enableHiding: false,
      enableSorting: false,
      size: 72,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.id}</span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      size: 96,
      cell: ({ row }) => <RecoveryStatusBadge status={row.original.status} />,
    },
    {
      id: "model",
      accessorFn: (r) => r.response_model_id,
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      enableSorting: false,
      size: 160,
      cell: ({ row }) => {
        const model = row.original.response_model_id;
        const upstream = row.original.upstream_model;
        return (
          <div className="min-w-0">
            <TruncateCell className="font-medium" text={model || "—"} />
            {upstream && upstream !== model ? (
              <TruncateCell
                className="text-muted-foreground text-[10px]"
                text={`→ ${upstream}`}
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: "user_channel",
      accessorFn: (r) => `${r.user_id}/${r.channel_id}`,
      header: ({ column }) => <ColumnHeader column={column} title="用户 / 渠道" />,
      enableSorting: false,
      size: 96,
      cell: ({ row }) => (
        <TruncateCell
          className="text-muted-foreground tabular-nums"
          text={`${row.original.user_id} / ${row.original.channel_id}`}
        />
      ),
    },
    {
      id: "attempts",
      accessorFn: (r) => r.attempt_count,
      header: ({ column }) => <ColumnHeader column={column} title="重试" />,
      enableSorting: false,
      size: 72,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.attempt_count} / {row.original.max_attempts}
        </span>
      ),
    },
    {
      id: "amounts",
      accessorFn: (r) => Number(r.authorized_amount),
      header: ({ column }) => <ColumnHeader column={column} title="冻结" />,
      enableSorting: false,
      size: 108,
      cell: ({ row }) => {
        // 冻结额 = LEAST(可用余额, 预估):余额充足时两者相等,只显一行「冻结」。
        // 仅「部分冻结」(余额不足,冻结<预估)时才补显预估并标黄,提示资金风险。
        const partial = Number(row.original.authorized_amount) < Number(row.original.estimated_amount);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            {moneyLine("冻结", formatUSDPrecise(row.original.authorized_amount), "strong")}
            {partial ? moneyLine("预估", formatUSDPrecise(row.original.estimated_amount), "warn") : null}
          </div>
        );
      },
    },
    {
      id: "settlement",
      accessorFn: (r) => Number(r.captured_amount),
      header: ({ column }) => <ColumnHeader column={column} title="实扣/释放" />,
      enableSorting: false,
      size: 148,
      cell: ({ row }) => recoverySettlementCell(row.original),
    },
    {
      id: "last_error",
      accessorFn: (r) => r.last_error_code ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="最近错误" />,
      enableSorting: false,
      size: 200,
      cell: ({ row }) => {
        const code = row.original.last_error_code;
        const message = row.original.last_error_message;
        if (!code && !message) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="min-w-0" title={message ?? undefined}>
            {code ? (
              <TruncateCell className="text-destructive font-mono text-[11px]" text={code} />
            ) : null}
            {message ? (
              <TruncateCell className="text-muted-foreground text-[10px]" text={message} />
            ) : null}
          </div>
        );
      },
    },
    {
      id: "next_run_at",
      accessorFn: (r) => r.next_run_at,
      header: ({ column }) => <ColumnHeader column={column} title="下次执行" />,
      enableSorting: false,
      size: 148,
      cell: ({ row }) => {
        // 终态(succeeded/dead)后 next_run_at 无调度意义,显示 — 减少噪声。
        const terminal =
          row.original.status === "succeeded" || row.original.status === "dead";
        return (
          <span className="text-muted-foreground tabular-nums">
            {terminal ? "—" : formatDateTime(row.original.next_run_at)}
          </span>
        );
      },
    },
    {
      id: "completed_at",
      accessorFn: (r) => r.completed_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="完成时间" />,
      enableSorting: false,
      size: 148,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.completed_at ? formatDateTime(row.original.completed_at) : "—"}
        </span>
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="创建时间" />,
      size: 148,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      size: 88,
      cell: ({ row }) => {
        const requestId = row.original.request_public_id;
        return (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <RecoveryJobDetailDialog jobId={row.original.id}>
              <Button variant="ghost" size="icon-sm" aria-label="补偿任务详情">
                <EyeIcon />
              </Button>
            </RecoveryJobDetailDialog>
            {requestId ? (
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
            ) : null}
          </div>
        );
      },
    },
  ];
}

export function syncJobOsColumns(): ColumnDef<SyncJob, unknown>[] {
  return [
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.id}</span>
      ),
    },
    {
      id: "source",
      accessorKey: "source",
      header: ({ column }) => <ColumnHeader column={column} title="来源" />,
      cell: ({ row }) => <TruncateCell text={row.original.source} />,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          {syncStatusBadge(row.original.status)}
          {row.original.error_text ? (
            <div className="text-destructive truncate text-xs" title={row.original.error_text}>
              {row.original.error_text}
            </div>
          ) : null}
        </div>
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
      id: "finished_at",
      accessorFn: (r) => r.finished_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="结束时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.finished_at ? formatDateTime(row.original.finished_at) : "—"}
        </span>
      ),
    },
  ];
}
