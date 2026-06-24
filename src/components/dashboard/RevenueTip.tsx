import { formatPercent, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { profitRate, type Revenue } from "@/components/dashboard/metrics";

function SummaryRow({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "cost" | "profit";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        {tone ? (
          <span
            className={cn(
              "size-1.5 rounded-full",
              tone === "cost" ? "bg-muted-foreground/40" : "bg-emerald-500/85",
            )}
          />
        ) : null}
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** 营收卡片悬浮详情：收入构成（成本 + 利润）+ 利润率。 */
export function RevenueTip({ revenue }: { revenue: Revenue }) {
  const rev = Number(revenue.revenue_usd);
  const cost = Number(revenue.cost_usd);
  const margin = Number(revenue.margin_usd);
  const rate = profitRate(revenue);

  const costPct = rev > 0 ? Math.min(cost / rev, 1) : 0;
  const profitPct = Math.max(0, 1 - costPct);

  return (
    <div className="flex w-72 flex-col gap-3">
      {/* 顶栏 + 利润 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">营收</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            利润 = 收入 − 成本
          </div>
        </div>
        <Badge
          variant={margin < 0 ? "destructive" : "secondary"}
          className="tabular-nums"
        >
          利润率 {rev > 0 ? formatPercent(rate) : "—"}
        </Badge>
      </div>

      {/* 收入构成比例条 */}
      {rev > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
            {costPct > 0 ? (
              <div
                className="bg-muted-foreground/40 h-full"
                style={{ width: `${costPct * 100}%` }}
              />
            ) : null}
            {profitPct > 0 ? (
              <div
                className="bg-emerald-500/85 h-full"
                style={{ width: `${profitPct * 100}%` }}
              />
            ) : null}
          </div>
          <p className="text-muted-foreground text-[10px] leading-snug">
            比例条按收入拆分为成本与利润；利润为负时不展示利润段。
          </p>
        </div>
      ) : null}

      <Separator />

      {/* 汇总 */}
      <div className="flex flex-col gap-1.5">
        <SummaryRow label="收入" value={formatUSD(revenue.revenue_usd)} />
        <SummaryRow label="成本" value={formatUSD(revenue.cost_usd)} tone="cost" />
        <SummaryRow
          label="利润"
          value={formatUSD(revenue.margin_usd)}
          tone="profit"
          emphasis
        />
      </div>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        收入为客户结算扣费，成本为上游支出（均为 USD）。利润率 = 利润 ÷ 收入。
      </p>
    </div>
  );
}

/** 卡片副栏：收入 · 成本。 */
export function RevenueHint({ revenue }: { revenue: Revenue }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 tabular-nums">
      <span className="truncate">收入 {formatUSD(revenue.revenue_usd)}</span>
      <span className="truncate text-right">成本 {formatUSD(revenue.cost_usd)}</span>
    </div>
  );
}
