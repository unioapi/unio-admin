/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { getModelOpsChannels } from "@/lib/api/modelsOps";
import type { ModelOpsRow } from "@/lib/api/modelsOps";
import { profitIntent } from "@/components/dashboard/metrics";
import { RevenueTip } from "@/components/dashboard/RevenueTip";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { ModelRowActions } from "@/components/models/ModelRowActions";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { AttemptSuccessRateCell } from "@/components/ops-tables/AttemptSuccessRateCell";
import {
  formatCompact,
  formatDateTime,
  formatPercent,
  formatUSD,
  trimDecimal,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function modelFailed(row: ModelOpsRow): number {
  return Math.max(0, row.request_total - row.request_succeeded);
}

function modelCostUsd(row: ModelOpsRow): string {
  const rev = Number(row.revenue_usd);
  const margin = Number(row.margin_usd);
  if (!Number.isFinite(rev) || !Number.isFinite(margin)) return "0";
  return String(Math.max(0, rev - margin));
}

const facetedFilter: FilterFn<ModelOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const MODEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "模型",
  bindings: "渠道",
  requests: "请求",
  success_rate: "成功率",
  failed: "失败",
  latency: "平均延迟",
  margin: "利润",
  price: "基准价",
  margin_rate: "毛利率",
  created_at: "创建时间",
  status: "状态",
  sellable: "可售",
  action: "操作",
};

// 基准价 tooltip 的完整明细字段（每 1M tokens）；顺序与文案固定，渲染时仅展示非空项。
const BASE_PRICE_BREAKDOWN: {
  key:
    | "base_uncached_input_price"
    | "base_cache_read_input_price"
    | "base_output_price"
    | "base_reasoning_output_price"
    | "base_cache_write_5m_input_price"
    | "base_cache_write_1h_input_price";
  label: string;
}[] = [
  { key: "base_uncached_input_price", label: "输入（未缓存）" },
  { key: "base_cache_read_input_price", label: "缓存读取输入" },
  { key: "base_output_price", label: "输出" },
  { key: "base_reasoning_output_price", label: "reasoning 输出" },
  { key: "base_cache_write_5m_input_price", label: "5 分钟缓存写入" },
  { key: "base_cache_write_1h_input_price", label: "1 小时缓存写入" },
];

// BasePriceCell 渲染模型「基准价」（model_prices 当前生效行，每 1M tokens）：
// 无基准价（uncached_input 为空）→「缺价」徽标；否则 `{输入价} / {输出价}` + 悬浮显示完整明细。
function BasePriceCell({ row }: { row: ModelOpsRow }) {
  const input = row.base_uncached_input_price;
  if (input == null) {
    return <Badge variant="destructive">缺价</Badge>;
  }
  const output = row.base_output_price;
  const breakdown = BASE_PRICE_BREAKDOWN.flatMap(({ key, label }) => {
    const value = row[key];
    return value == null ? [] : [{ label, value: trimDecimal(value) }];
  });
  breakdown.push({ label: "币种", value: row.base_currency ?? "USD" });

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted underline-offset-2"
        >
          {trimDecimal(input)} / {output == null ? "—" : trimDecimal(output)}
        </button>
      </TooltipTrigger>
      <TooltipContent align="start" className="max-w-xs">
        <div className="flex flex-col gap-1.5">
          <div className="font-medium">基准价 · 每 1M tokens</div>
          <div className="flex flex-col gap-0.5">
            {breakdown.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-background/70">{label}</span>
                <span className="tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ModelBindingsTip({
  modelRef,
  displayName,
  available,
  total,
  channels,
}: {
  modelRef: string;
  displayName: string;
  available: number;
  total: number;
  channels: Array<{
    channel_id: number;
    channel_name: string;
    channel_status: string;
    upstream_model: string;
    input_cost: string | null;
    output_cost: string | null;
  }>;
}) {
  const showDisplayName =
    displayName && displayName.toLowerCase() !== modelRef.toLowerCase();

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold leading-tight">{modelRef}</div>
          {showDisplayName ? (
            <div className="text-muted-foreground mt-0.5 truncate text-[11px]">{displayName}</div>
          ) : null}
        </div>
        <Badge variant={available > 0 ? "secondary" : "outline"} className="shrink-0 tabular-nums">
          {available}/{total} 可用
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-0.5 text-[10px] font-medium uppercase tracking-wide">
          <span>渠道</span>
          <span className="text-right">成本 / 1M</span>
        </div>
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {channels.map((c) => {
            const isAvailable =
              c.channel_status === "enabled" &&
              c.input_cost != null &&
              c.output_cost != null;
            const showUpstream = c.upstream_model && c.upstream_model !== modelRef;
            return (
              <li
                key={c.channel_id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-md border px-2.5 py-2",
                  isAvailable ? "bg-muted/35 border-border/60" : "bg-muted/15 border-dashed",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{c.channel_name}</span>
                    {!isAvailable ? (
                      <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                        不可用
                      </Badge>
                    ) : null}
                  </div>
                  {showUpstream ? (
                    <div className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                      → {c.upstream_model}
                    </div>
                  ) : null}
                </div>
                {c.input_cost != null && c.output_cost != null ? (
                  <div className="text-muted-foreground shrink-0 text-right text-[10px] leading-snug tabular-nums">
                    <div>
                      <span className="text-muted-foreground/70">In </span>
                      {trimDecimal(c.input_cost)}
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Out </span>
                      {trimDecimal(c.output_cost)}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground shrink-0 self-center text-[10px]">无价</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ModelBindingsCell({
  modelId,
  modelRef,
  displayName,
  available,
  total,
}: {
  modelId: number;
  modelRef: string;
  displayName: string;
  available: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const channelsQuery = useQuery({
    queryKey: ["model", modelId, "ops-channels", "bindings-tip"],
    queryFn: () => getModelOpsChannels(modelId, { range: "all" }),
    enabled: open,
  });
  const channels = (channelsQuery.data ?? []).filter((c) => c.binding_status === "enabled");
  const loading = channelsQuery.isPending;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "tabular-nums",
            "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
          )}
        >
          {available}/{total}
        </span>
      </HoverCardTrigger>
      <TipHoverCardContent align="start">
        {loading ? (
          <p className="text-muted-foreground text-xs">加载渠道…</p>
        ) : channelsQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : channels.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无绑定渠道</p>
        ) : (
          <ModelBindingsTip
            modelRef={modelRef}
            displayName={displayName}
            available={available}
            total={total}
            channels={channels}
          />
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}

export function modelOsColumns(): ColumnDef<ModelOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "model_id",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.model_id}
          className="font-medium"
          subtext={`${row.original.display_name} · ${row.original.owned_by}`}
        />
      ),
    },
    {
      id: "bindings",
      accessorFn: (r) => r.bindings_available,
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      cell: ({ row }) => (
        <ModelBindingsCell
          modelId={row.original.id}
          modelRef={row.original.model_id}
          displayName={row.original.display_name}
          available={row.original.bindings_available}
          total={row.original.bindings_total}
        />
      ),
    },
    {
      id: "requests",
      accessorKey: "request_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(row.original.request_total)}</span>
      ),
    },
    {
      id: "success_rate",
      accessorKey: "success_rate",
      header: ({ column }) => <ColumnHeader column={column} title="成功率" />,
      cell: ({ row }) => (
        <AttemptSuccessRateCell
          attemptTotal={row.original.request_total}
          attemptSucceeded={row.original.request_succeeded}
          successRate={row.original.success_rate}
        />
      ),
    },
    {
      id: "failed",
      accessorFn: (r) => modelFailed(r),
      header: ({ column }) => <ColumnHeader column={column} title="失败" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCompact(modelFailed(row.original))}</span>
      ),
    },
    {
      id: "latency",
      accessorFn: (r) => r.latency.avg,
      header: ({ column }) => <ColumnHeader column={column} title="平均延迟" />,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
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
                cost_usd: modelCostUsd(row.original),
                margin_usd: row.original.margin_usd,
              }}
              title={row.original.display_name}
            />
          </TipHoverCardContent>
        </HoverCard>
      ),
    },
    {
      id: "price",
      accessorFn: (r) => r.base_uncached_input_price,
      header: ({ column }) => <ColumnHeader column={column} title="基准价" />,
      cell: ({ row }) => <BasePriceCell row={row.original} />,
    },
    {
      id: "margin_rate",
      accessorKey: "margin_rate",
      header: ({ column }) => <ColumnHeader column={column} title="毛利率" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatPercent(row.original.margin_rate)}</span>
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
      filterFn: facetedFilter,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    },
    {
      id: "sellable",
      accessorFn: (r) => (r.sellable ? "true" : "false"),
      header: ({ column }) => <ColumnHeader column={column} title="可售" />,
      filterFn: facetedFilter,
      cell: ({ row }) =>
        row.original.sellable ? (
          <Badge variant="default">可售</Badge>
        ) : (
          <Badge variant="destructive">不可售</Badge>
        ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <ModelRowActions modelId={row.original.id} />,
    },
  ];
}
