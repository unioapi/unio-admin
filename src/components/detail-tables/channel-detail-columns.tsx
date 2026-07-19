import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "lucide-react";
import type { ChannelOpsError, ChannelOpsModel, ChannelOpsRoute } from "@/lib/api/channelsOps";
import { resizableColumn } from "@/components/data-table";
import { requestIdLinkColumn } from "./shared-columns";
import { AttemptLatencyCell } from "@/components/table-cells/AttemptLatencyCell";
import { AttemptSuccessRateCell } from "@/components/table-cells/AttemptSuccessRateCell";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { formatChartTs, formatCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";

export const CHANNEL_OPS_ERROR_COLUMN_LABELS: Record<string, string> = {
  at: "时间",
  upstream_model: "模型",
  error_code: "错误码",
  upstream_status_code: "HTTP",
  error_message: "错误信息",
  request_id: "请求",
};

export const CHANNEL_OPS_MODEL_COLUMN_LABELS: Record<string, string> = {
  model: "模型",
  upstream_model: "上游名",
  attempt_total: "尝试",
  success_rate: "成功率",
  latency: "平均延迟",
  has_price: "价格",
};

export const CHANNEL_OPS_ROUTE_COLUMN_LABELS: Record<string, string> = {
  name: "线路",
  mode: "策略",
  status: "状态",
  action: "操作",
};

export function channelOpsErrorColumns(): ColumnDef<ChannelOpsError, unknown>[] {
  return [
    resizableColumn<ChannelOpsError>("at", {
      header: "时间",
      size: 112,
      minSize: 88,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatChartTs(row.original.at)}</span>
      ),
    }),
    resizableColumn<ChannelOpsError>("upstream_model", {
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
    resizableColumn<ChannelOpsError>("error_code", {
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
    resizableColumn<ChannelOpsError>("upstream_status_code", {
      header: "HTTP",
      size: 72,
      minSize: 56,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.upstream_status_code ?? "—"}</span>
      ),
    }),
    resizableColumn<ChannelOpsError>("error_message", {
      header: "错误信息",
      size: 320,
      minSize: 180,
      cell: ({ row }) => (
        <TruncateCell
          className="text-xs"
          text={row.original.error_message || "—"}
        />
      ),
    }),
    requestIdLinkColumn<ChannelOpsError>(),
  ];
}

export function channelOpsModelColumns(): ColumnDef<ChannelOpsModel, unknown>[] {
  return [
    resizableColumn<ChannelOpsModel>("model", {
      header: "模型",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.model_ref}
          className="text-xs font-medium"
          subtext={row.original.display_name}
        />
      ),
    }),
    resizableColumn<ChannelOpsModel>("upstream_model", {
      header: "上游名",
      size: 160,
      minSize: 120,
      cell: ({ row }) => (
        <TruncateCell className="text-muted-foreground text-xs" text={row.original.upstream_model} />
      ),
    }),
    resizableColumn<ChannelOpsModel>("attempt_total", {
      header: "尝试",
      size: 96,
      minSize: 72,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatCompact(row.original.attempt_total)}</span>
      ),
    }),
    resizableColumn<ChannelOpsModel>("success_rate", {
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
    resizableColumn<ChannelOpsModel>("latency", {
      header: "平均延迟",
      size: 112,
      minSize: 88,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} className="text-xs" />,
    }),
    resizableColumn<ChannelOpsModel>("has_price", {
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
  ];
}

export function channelOpsRouteColumns(): ColumnDef<ChannelOpsRoute, unknown>[] {
  return [
    resizableColumn<ChannelOpsRoute>("name", {
      header: "线路",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.name}</span>
      ),
    }),
    resizableColumn<ChannelOpsRoute>("mode", {
      header: "策略",
      size: 100,
      minSize: 72,
      cell: ({ row }) => (
        <span className="text-xs">
          {ROUTE_MODE_LABEL[row.original.mode] ?? row.original.mode}
        </span>
      ),
    }),
    resizableColumn<ChannelOpsRoute>("status", {
      header: "状态",
      size: 88,
      minSize: 72,
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    }),
    resizableColumn<ChannelOpsRoute>("action", {
      header: "操作",
      size: 80,
      minSize: 64,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/routes/${row.original.id}`}>
            详情
            <ArrowUpRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      ),
    }),
  ];
}
