import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/api/providers";
import type { ProviderOpsRow } from "@/lib/api/providersOps";
import { profitIntent, rateIntent } from "@/components/dashboard/metrics";
import { RevenueTip } from "@/components/dashboard/RevenueTip";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { STATUS_LABEL } from "@/components/dashboard/breakdown-table/constants";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { DeleteProviderDialog } from "@/components/providers/DeleteProviderDialog";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import {
  formatCompact,
  formatDateTime,
  formatInt,
  formatPercent,
  formatTPS,
  formatUSD,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

type StatIntent = "default" | "success" | "warning" | "danger";

function statIntentClass(intent: StatIntent | undefined): string {
  switch (intent) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "danger":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

function toProvider(row: ProviderOpsRow): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    updated_at: "",
  };
}

/** facet 多选筛选：列值（标量）命中所选集合即保留。 */
const facetedFilter: FilterFn<ProviderOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const PROVIDER_OS_COLUMN_LABELS: Record<string, string> = {
  name: "服务商",
  channels: "渠道",
  requests: "请求",
  success_rate: "成功率",
  latency: "平均延迟",
  tps: "平均 TPS",
  tokens: "Token",
  margin: "利润",
  timeout: "超时",
  created_at: "创建时间",
  status: "状态",
  health: "健康",
  action: "操作",
};

export function providerOsColumns(): ColumnDef<ProviderOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="服务商" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={row.original.slug}
        />
      ),
    },
    {
      id: "channels",
      accessorFn: (r) => r.channel_enabled,
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.channel_enabled}/{row.original.channel_total}
        </span>
      ),
    },
    {
      id: "requests",
      accessorKey: "attempt_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCompact(row.original.attempt_total)}
        </span>
      ),
    },
    {
      id: "success_rate",
      accessorKey: "success_rate",
      header: ({ column }) => <ColumnHeader column={column} title="成功率" />,
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums",
            statIntentClass(rateIntent(row.original.success_rate)),
          )}
        >
          {formatPercent(row.original.success_rate)}
        </span>
      ),
    },
    {
      id: "latency",
      accessorFn: (r) => r.latency.avg,
      header: ({ column }) => <ColumnHeader column={column} title="平均延迟" />,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
    },
    {
      id: "tps",
      accessorKey: "avg_tps",
      header: ({ column }) => <ColumnHeader column={column} title="平均 TPS" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatTPS(row.original.avg_tps)}</span>
      ),
    },
    {
      id: "tokens",
      accessorKey: "tokens",
      header: ({ column }) => <ColumnHeader column={column} title="Token" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.tokens)}</span>
      ),
    },
    {
      id: "margin",
      accessorFn: (r) => Number(r.margin_usd),
      header: ({ column }) => <ColumnHeader column={column} title="利润" />,
      cell: ({ row }) => (
        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className={cn(
                "cursor-default tabular-nums underline decoration-dotted underline-offset-2",
                statIntentClass(profitIntent(Number(row.original.margin_usd))),
              )}
            >
              {formatUSD(row.original.margin_usd)}
            </button>
          </HoverCardTrigger>
          <TipHoverCardContent align="end">
            <RevenueTip
              revenue={{
                revenue_usd: row.original.revenue_usd,
                cost_usd: row.original.cost_usd,
                margin_usd: row.original.margin_usd,
              }}
              title={row.original.name}
            />
          </TipHoverCardContent>
        </HoverCard>
      ),
    },
    {
      id: "timeout",
      accessorKey: "timeout_total",
      header: ({ column }) => <ColumnHeader column={column} title="超时" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatInt(row.original.timeout_total)}</span>
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="创建时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: { label: "状态", fixedWidth: true },
      filterFn: facetedFilter,
      cell: ({ row }) =>
        row.original.status ? (
          <Badge
            variant={row.original.status === "enabled" ? "default" : "secondary"}
          >
            {STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "health",
      accessorKey: "health",
      header: ({ column }) => <ColumnHeader column={column} title="健康" />,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "健康", fixedWidth: true },
      filterFn: facetedFilter,
      cell: ({ row }) => (
        <Badge variant={HEALTH_VARIANT[row.original.health]}>
          {HEALTH_LABEL[row.original.health]}
        </Badge>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const provider = toProvider(row.original);
        return (
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
              <Link to={`/providers/${row.original.id}`}>
                <EyeIcon />
              </Link>
            </Button>
            <ProviderFormDialog provider={provider}>
              <Button variant="ghost" size="icon-sm" aria-label="编辑">
                <PencilIcon />
              </Button>
            </ProviderFormDialog>
            <DeleteProviderDialog provider={provider}>
              <Button variant="ghost" size="icon-sm" aria-label="删除">
                <Trash2Icon className="text-destructive" />
              </Button>
            </DeleteProviderDialog>
          </div>
        );
      },
    },
  ];
}
