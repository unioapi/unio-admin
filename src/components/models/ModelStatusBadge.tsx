import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ModelSellabilityInput {
  status: string;
  sellable: boolean;
  bindings_total: number;
  bindings_available: number;
}

/** 不可售时的运维原因（与后端 sellable = enabled ∧ bindings_available>0 对齐）。 */
export function modelSellabilityReasons(row: ModelSellabilityInput): string[] {
  if (row.status !== "enabled") {
    return ["模型已停用，不参与路由"];
  }
  if (row.sellable) {
    return [];
  }
  if (row.bindings_total === 0) {
    return ["未绑定任何 enabled 渠道"];
  }
  return [
    `已绑定 ${row.bindings_total} 条渠道，但 0 条可用（${row.bindings_available}/${row.bindings_total}）`,
    "常见原因：渠道已停用、绑定已停用，或缺少 enabled 的渠道售价",
  ];
}

function sellabilityTooltip(row: ModelSellabilityInput): string[] {
  const reasons = modelSellabilityReasons(row);
  if (reasons.length > 0) return reasons;
  if (row.sellable) {
    return [
      `至少 1 条可用渠道（${row.bindings_available}/${row.bindings_total}）`,
      "绑定启用 + 渠道启用 + 有 enabled 渠道售价",
    ];
  }
  return [];
}

function statusBadgeVariant(row: ModelSellabilityInput): "default" | "secondary" | "destructive" | "outline" {
  if (row.status !== "enabled") return "outline";
  return row.sellable ? "default" : "destructive";
}

function statusLabel(row: ModelSellabilityInput): string {
  if (row.status !== "enabled") return "停用";
  return row.sellable ? "启用 · 可售" : "启用 · 不可售";
}

export function ModelStatusBadge({
  row,
  className,
}: {
  row: ModelSellabilityInput;
  className?: string;
}) {
  const tips = sellabilityTooltip(row);
  const badge = (
    <Badge variant={statusBadgeVariant(row)} className={cn("whitespace-nowrap font-normal", className)}>
      {statusLabel(row)}
    </Badge>
  );

  if (tips.length === 0) return badge;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
        >
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent align="start" className="max-w-xs">
        <ul className="flex flex-col gap-1 text-xs">
          {tips.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
