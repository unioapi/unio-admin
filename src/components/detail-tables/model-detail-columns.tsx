import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "lucide-react";
import type { ModelOpsChannel, ModelOpsRequest } from "@/lib/api/modelsOps";
import { resizableColumn } from "@/components/data-table";
import { requestIdLinkColumn } from "./shared-columns";
import { HEALTH_LABEL, HEALTH_VARIANT, healthBucketOf } from "@/components/channels/health";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { formatChartTs, formatCompact, formatLatencyMs } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const MODEL_OPS_CHANNEL_COLUMN_LABELS: Record<string, string> = {
  channel: "渠道",
  health: "健康",
  attempt_total: "尝试",
  success_rate: "成功率",
  latency_p95: "P95",
  has_price: "价格",
  action: "操作",
};

export const MODEL_OPS_REQUEST_COLUMN_LABELS: Record<string, string> = {
  at: "时间",
  status: "状态",
  latency_ms: "延迟",
  request_id: "请求",
};

export function modelOpsChannelColumns(): ColumnDef<ModelOpsChannel, unknown>[] {
  return [
    resizableColumn<ModelOpsChannel>("channel", {
      header: "渠道",
      size: 220,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.original.channel_name}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.upstream_model}</div>
        </div>
      ),
    }),
    resizableColumn<ModelOpsChannel>("health", {
      header: "健康",
      size: 88,
      minSize: 72,
      cell: ({ row }) => {
        const bucket = healthBucketOf(row.original.attempt_succeeded, row.original.attempt_total);
        return (
          <Badge variant={HEALTH_VARIANT[bucket]}>{HEALTH_LABEL[bucket]}</Badge>
        );
      },
    }),
    resizableColumn<ModelOpsChannel>("attempt_total", {
      header: "尝试",
      size: 96,
      minSize: 72,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatCompact(row.original.attempt_total)}</span>
      ),
    }),
    resizableColumn<ModelOpsChannel>("success_rate", {
      header: "成功率",
      size: 96,
      minSize: 80,
      cell: ({ row }) => (
        <AttemptSuccessRateCell
          attemptTotal={row.original.attempt_total}
          attemptSucceeded={row.original.attempt_succeeded}
          successRate={row.original.success_rate}
          className="text-xs"
        />
      ),
    }),
    resizableColumn<ModelOpsChannel>("latency_p95", {
      header: "P95",
      size: 112,
      minSize: 88,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatLatencyMs(row.original.latency_p95)}</span>
      ),
    }),
    resizableColumn<ModelOpsChannel>("has_price", {
      header: "价格",
      size: 96,
      minSize: 72,
      cell: ({ row }) =>
        row.original.has_price ? (
          <Badge variant="default">已配置</Badge>
        ) : (
          <Badge variant="destructive">缺价</Badge>
        ),
    }),
    resizableColumn<ModelOpsChannel>("action", {
      header: "操作",
      size: 80,
      minSize: 64,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/channels/${row.original.channel_id}`}>
            详情
            <ArrowUpRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      ),
    }),
  ];
}

export function modelOpsRequestColumns(): ColumnDef<ModelOpsRequest, unknown>[] {
  return [
    resizableColumn<ModelOpsRequest>("at", {
      header: "时间",
      size: 112,
      minSize: 88,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatChartTs(row.original.at)}</span>
      ),
    }),
    resizableColumn<ModelOpsRequest>("status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => <span className="text-xs">{row.original.status}</span>,
    }),
    resizableColumn<ModelOpsRequest>("latency_ms", {
      header: "延迟",
      size: 112,
      minSize: 88,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {row.original.latency_ms != null ? formatLatencyMs(row.original.latency_ms) : "—"}
        </span>
      ),
    }),
    requestIdLinkColumn<ModelOpsRequest>(),
  ];
}
