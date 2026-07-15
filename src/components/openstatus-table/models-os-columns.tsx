import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { getModelOpsChannels } from "@/lib/api/modelsOps";
import type { ModelOpsRow } from "@/lib/api/modelsOps";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { ModelCapabilitiesCountCell } from "@/components/models/ModelCapabilitiesCountCell";
import { ModelIOCapabilityCell } from "@/components/models/ModelIOCapabilityCell";
import { ModelRowActions } from "@/components/models/ModelRowActions";
import { ModelStatusBadge } from "@/components/models/ModelStatusBadge";
import {
  formatDateTime,
  formatTokenScale,
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
import type { FacetOption } from "./types";

/** 模型状态筛选项（与 models_status_check 一致：仅启停，无归档）。 */
export const MODEL_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
];

const facetedFilter: FilterFn<ModelOpsRow> = (row, columnId, filterValue) => {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(String(row.getValue(columnId)));
};

export const MODEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "模型",
  status: "状态",
  bindings: "渠道",
  capabilities_input: "输入",
  capabilities_output: "输出",
  capabilities: "能力",
  max_output: "最大输出",
  context: "上下文",
  price: "基准价",
  created_at: "创建时间",
  action: "操作",
};

const BASE_PRICE_BREAKDOWN: {
  key:
    | "base_uncached_input_price"
    | "base_cache_read_input_price"
    | "base_output_price"
    | "base_reasoning_output_price"
    | "base_cache_write_5m_input_price"
    | "base_cache_write_1h_input_price"
    | "base_cache_write_30m_input_price";
  label: string;
}[] = [
  { key: "base_uncached_input_price", label: "输入（未缓存）" },
  { key: "base_cache_read_input_price", label: "缓存读取输入" },
  { key: "base_output_price", label: "输出" },
  { key: "base_reasoning_output_price", label: "reasoning 输出" },
  { key: "base_cache_write_5m_input_price", label: "5 分钟缓存写入 · Anthropic" },
  { key: "base_cache_write_1h_input_price", label: "1 小时缓存写入 · Anthropic" },
  { key: "base_cache_write_30m_input_price", label: "30 分钟缓存写入 · OpenAI" },
];

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

function ModelStatusCell({ row }: { row: ModelOpsRow }) {
  return (
    <ModelStatusBadge
      row={{
        status: row.status,
        sellable: row.sellable,
        bindings_total: row.bindings_total,
        bindings_available: row.bindings_available,
      }}
    />
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
    has_price: boolean;
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
            // 可用口径与后端 has_price（DEC-031）对齐：绝对覆盖或基准价×倍率可解析即视为有价。
            const isAvailable = c.channel_status === "enabled" && c.has_price;
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
      meta: {
        autoSizeValue: (row: ModelOpsRow) =>
          `${row.model_id} ${row.display_name} · ${row.owned_by}`,
      },
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.model_id}
          className="font-medium"
          subtext={`${row.original.display_name} · ${row.original.owned_by}`}
        />
      ),
    },
    {
      id: "status",
      accessorFn: (r) => `${r.status}:${r.sellable ? "sellable" : "unsellable"}`,
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableSorting: false,
      filterFn: facetedFilter,
      cell: ({ row }) => <ModelStatusCell row={row.original} />,
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
      id: "capabilities_input",
      header: () => <span className="text-muted-foreground">输入</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ModelIOCapabilityCell modelId={row.original.id} direction="input" />
      ),
    },
    {
      id: "capabilities_output",
      header: () => <span className="text-muted-foreground">输出</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ModelIOCapabilityCell modelId={row.original.id} direction="output" />
      ),
    },
    {
      id: "capabilities",
      accessorFn: (r) => r.capabilities_declared_count,
      header: () => <span className="text-muted-foreground">能力</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ModelCapabilitiesCountCell
          modelId={row.original.id}
          count={row.original.capabilities_declared_count}
        />
      ),
    },
    {
      id: "max_output",
      accessorFn: (r) => r.max_output_tokens,
      header: ({ column }) => <ColumnHeader column={column} title="最大输出" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatTokenScale(row.original.max_output_tokens)}
        </span>
      ),
    },
    {
      id: "context",
      accessorFn: (r) => r.context_window_tokens,
      header: ({ column }) => <ColumnHeader column={column} title="上下文" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatTokenScale(row.original.context_window_tokens)}
        </span>
      ),
    },
    {
      id: "price",
      accessorFn: (r) => r.base_uncached_input_price,
      header: ({ column }) => <ColumnHeader column={column} title="基准价" />,
      enableSorting: false,
      cell: ({ row }) => <BasePriceCell row={row.original} />,
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
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <ModelRowActions modelId={row.original.id} />,
    },
  ];
}
