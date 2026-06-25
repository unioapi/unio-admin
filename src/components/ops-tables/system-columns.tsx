import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type { SyncJob } from "@/lib/api/capability";
import type { ChannelHealth, ChannelHealthBucket, RecoveryJobSummary } from "@/lib/api/system";
import { resizableColumn } from "@/components/data-table";
import { formatDateTime, trimDecimal } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecoveryStatusBadge } from "@/components/system/RecoveryStatusBadge";
import { RecoveryJobDetailDialog } from "@/components/system/RecoveryJobDetailDialog";

export const BUCKET_META: Record<
  ChannelHealthBucket,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  healthy: { label: "健康", badge: "default" },
  degraded: { label: "降级", badge: "secondary" },
  unhealthy: { label: "异常", badge: "destructive" },
  no_data: { label: "无数据", badge: "outline" },
};

function syncStatusBadge(status: string) {
  if (status === "succeeded") return <Badge variant="default">成功</Badge>;
  if (status === "running") return <Badge variant="secondary">运行中</Badge>;
  if (status === "failed") return <Badge variant="destructive">失败</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function recoveryJobColumns(): ColumnDef<RecoveryJobSummary, unknown>[] {
  return [
    resizableColumn<RecoveryJobSummary>("id", {
      header: "ID",
      size: 72,
      minSize: 56,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.id}</span>
      ),
    }),
    resizableColumn<RecoveryJobSummary>("status", {
      header: "状态",
      size: 96,
      cell: ({ row }) => <RecoveryStatusBadge status={row.original.status} />,
    }),
    resizableColumn<RecoveryJobSummary>("user_channel", {
      header: "用户 / 渠道",
      size: 140,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.user_id} / {row.original.channel_id}
        </span>
      ),
    }),
    resizableColumn<RecoveryJobSummary>("attempts", {
      header: "重试",
      size: 88,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.attempt_count} / {row.original.max_attempts}
        </span>
      ),
    }),
    resizableColumn<RecoveryJobSummary>("authorized_amount", {
      header: "冻结金额",
      size: 128,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {trimDecimal(row.original.authorized_amount)} {row.original.currency}
        </span>
      ),
    }),
    resizableColumn<RecoveryJobSummary>("created_at", {
      header: "创建时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    }),
    resizableColumn<RecoveryJobSummary>("action", {
      header: "操作",
      size: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <div >
          <RecoveryJobDetailDialog jobId={row.original.id}>
            <Button variant="ghost" size="icon-sm" aria-label="详情">
              <EyeIcon />
            </Button>
          </RecoveryJobDetailDialog>
        </div>
      ),
    }),
  ];
}

export function syncJobColumns(): ColumnDef<SyncJob, unknown>[] {
  return [
    resizableColumn<SyncJob>("id", {
      header: "ID",
      size: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.id}</span>
      ),
    }),
    resizableColumn<SyncJob>("source", {
      header: "来源",
      size: 160,
      cell: ({ row }) => row.original.source,
    }),
    resizableColumn<SyncJob>("status", {
      header: "状态",
      size: 140,
      cell: ({ row }) => (
        <>
          {syncStatusBadge(row.original.status)}
          {row.original.error_text ? (
            <div className="text-destructive mt-1 max-w-xs truncate text-xs">
              {row.original.error_text}
            </div>
          ) : null}
        </>
      ),
    }),
    resizableColumn<SyncJob>("created_at", {
      header: "创建时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{formatDateTime(row.original.created_at)}</span>
      ),
    }),
    resizableColumn<SyncJob>("finished_at", {
      header: "结束时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.finished_at ? formatDateTime(row.original.finished_at) : "—"}
        </span>
      ),
    }),
  ];
}

export function channelHealthColumns(): ColumnDef<ChannelHealth, unknown>[] {
  return [
    resizableColumn<ChannelHealth>("channel_id", {
      header: "ID",
      size: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.channel_id}</span>
      ),
    }),
    resizableColumn<ChannelHealth>("name", {
      header: "渠道",
      size: 180,
      minSize: 120,
      cell: ({ row }) => (
        <>
          <span className="font-medium">{row.original.name}</span>
          {row.original.status !== "enabled" ? (
            <Badge variant="outline" className="ml-2 text-xs">
              {row.original.status}
            </Badge>
          ) : null}
        </>
      ),
    }),
    resizableColumn<ChannelHealth>("bucket", {
      header: "健康",
      size: 96,
      cell: ({ row }) => {
        const meta = BUCKET_META[row.original.bucket];
        return <Badge variant={meta.badge}>{meta.label}</Badge>;
      },
    }),
    resizableColumn<ChannelHealth>("success_rate", {
      header: "成功率",
      size: 96,
      cell: ({ row }) =>
        row.original.attempt_total === 0
          ? "—"
          : `${(row.original.success_rate * 100).toFixed(1)}%`,
    }),
    resizableColumn<ChannelHealth>("attempts", {
      header: "尝试（成功/失败）",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.attempt_total}（{row.original.attempt_succeeded}/
          {row.original.attempt_failed}）
        </span>
      ),
    }),
    resizableColumn<ChannelHealth>("last_attempt_at", {
      header: "最近尝试",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_attempt_at ? formatDateTime(row.original.last_attempt_at) : "—"}
        </span>
      ),
    }),
  ];
}
