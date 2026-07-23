import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "lucide-react";
import type { ProviderOpsChannel, ProviderOpsError } from "@/lib/api/providersOps";
import { resizableColumn } from "@/components/data-table";
import { requestIdLinkColumn } from "./shared-columns";
import { AttemptLatencyCell } from "@/components/table-cells/AttemptLatencyCell";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { formatChartTs, formatCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";

export const PROVIDER_OPS_CHANNEL_COLUMN_LABELS: Record<string, string> = {
  channel: "渠道",
  status: "状态",
  attempt_total: "尝试",
  success_rate: "成功率",
  latency: "平均延迟",
  action: "操作",
};

export const PROVIDER_OPS_ERROR_COLUMN_LABELS: Record<string, string> = {
  at: "时间",
  channel_name: "渠道",
  upstream_model: "模型",
  error_code: "错误码",
  upstream_status_code: "HTTP",
  request_id: "请求",
};

export function providerOpsChannelColumns(): ColumnDef<ProviderOpsChannel, unknown>[] {
  return [
    resizableColumn<ProviderOpsChannel>("channel", {
      header: "渠道",
      size: 220,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.base_url}</div>
        </div>
      ),
    }),
    resizableColumn<ProviderOpsChannel>("status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    }),
    resizableColumn<ProviderOpsChannel>("attempt_total", {
      header: "尝试",
      size: 96,
      minSize: 72,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatCompact(row.original.attempt_total)}</span>
      ),
    }),
    resizableColumn<ProviderOpsChannel>("success_rate", {
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
    resizableColumn<ProviderOpsChannel>("latency", {
      header: "平均延迟",
      size: 112,
      minSize: 88,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} className="text-xs" />,
    }),
    resizableColumn<ProviderOpsChannel>("action", {
      header: "操作",
      size: 80,
      minSize: 64,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/channels/${row.original.id}`}>
            详情
            <ArrowUpRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      ),
    }),
  ];
}

export function providerOpsErrorColumns(): ColumnDef<ProviderOpsError, unknown>[] {
  return [
    resizableColumn<ProviderOpsError>("at", {
      header: "时间",
      size: 112,
      minSize: 88,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatChartTs(row.original.at)}</span>
      ),
    }),
    resizableColumn<ProviderOpsError>("channel_name", {
      header: "渠道",
      size: 160,
      minSize: 120,
      cell: ({ row }) => <span className="text-xs">{row.original.channel_name}</span>,
    }),
    resizableColumn<ProviderOpsError>("upstream_model", {
      header: "模型",
      size: 160,
      minSize: 120,
      cell: ({ row }) => (
        <TruncateCell
          className="text-muted-foreground text-xs"
          text={row.original.upstream_model || "—"}
        />
      ),
    }),
    resizableColumn<ProviderOpsError>("error_code", {
      header: "错误码",
      size: 120,
      minSize: 88,
      cell: ({ row }) =>
        row.original.error_code ? (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original.error_code}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    }),
    resizableColumn<ProviderOpsError>("upstream_status_code", {
      header: "HTTP",
      size: 72,
      minSize: 56,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.upstream_status_code ?? "—"}</span>
      ),
    }),
    requestIdLinkColumn<ProviderOpsError>(),
  ];
}
