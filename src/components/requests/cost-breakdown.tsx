import { formatInt, formatPercent, formatUSDPrecise, trimDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

// 费用明细共享组件：列表「费用」列悬浮与请求详情弹窗共用，展示 平台成本 / 用户价格（均含
// 「单价 × tokens = 金额」计算过程）+ 汇总（模型基准价 = 售价 ÷ 倍率、线路倍率、毛利）。
// token↔金额口径与后端一致：普通输出 = 输出总数 − 推理输出（见 billing/service.go calculateTokenAmountBreakdown）。

type Num = string | null | undefined;

// 计费维度的单价/金额集合（USD 十进制字符串，per_1m_tokens）。
// 缓存写入分 5m/1h（Anthropic）与 30m（OpenAI GPT-5.6+）三档，按 TTL 语义独立展示。
export interface SixUnit {
  uncachedInput: Num;
  cacheRead: Num;
  cacheWrite5m: Num;
  cacheWrite1h: Num;
  cacheWrite30m: Num;
  output: Num;
  reasoning: Num;
}

export interface SixAmount extends SixUnit {
  total: Num;
}

export interface CostBreakdownInput {
  tokens: {
    uncachedInput: number;
    cacheRead: number;
    cacheWrite5m: number;
    cacheWrite1h: number;
    cacheWrite30m: number;
    outputTotal: number;
    reasoningOutput: number;
  };
  costUnit: SixUnit; // 平台成本单价
  priceUnit: SixUnit; // 用户售价单价
  costAmount?: SixAmount | null; // 平台实际成本金额（快照权威，缺失时按单价×tokens 兜底）
  userCharge?: Num; // 用户实际扣费净额（ledger）
  routeRatio?: Num; // 线路倍率
}

function num(v: Num): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isNaN(x) ? null : x;
}

function computeAmount(unit: Num, tokens: number): number | null {
  const u = num(unit);
  if (u == null) return null;
  return (u * tokens) / 1_000_000;
}

interface LineDef {
  key: keyof SixUnit;
  label: string;
  tokens: number;
}

function buildLines(t: CostBreakdownInput["tokens"]): LineDef[] {
  const normalOutput = Math.max(0, t.outputTotal - t.reasoningOutput);
  return (
    [
      { key: "uncachedInput", label: "输入", tokens: t.uncachedInput },
      { key: "cacheRead", label: "缓存读取", tokens: t.cacheRead },
      { key: "cacheWrite5m", label: "缓存写入·5m", tokens: t.cacheWrite5m },
      { key: "cacheWrite1h", label: "缓存写入·1h", tokens: t.cacheWrite1h },
      { key: "cacheWrite30m", label: "缓存写入·30m", tokens: t.cacheWrite30m },
      { key: "output", label: "输出", tokens: normalOutput },
      { key: "reasoning", label: "推理输出", tokens: t.reasoningOutput },
    ] as LineDef[]
  ).filter((l) => l.tokens > 0);
}

function CalcRow({ label, unit, tokens, amount }: { label: string; unit: Num; tokens: number; amount: number | null }) {
  const u = num(unit);
  return (
    <div className="grid grid-cols-[5rem_1fr_auto] items-baseline gap-x-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground/70 font-mono text-[10px]">
        {u != null ? `$${trimDecimal(String(unit))}/1M` : "—"} × {formatInt(tokens)}
      </span>
      <span className="tabular-nums">{formatUSDPrecise(amount)}</span>
    </div>
  );
}

function TotalRow({ label, amount }: { label: string; amount: number | null }) {
  return (
    <div className="mt-0.5 flex items-center justify-between border-t border-dashed pt-1 font-medium">
      <span>{label}</span>
      <span className="tabular-nums">{formatUSDPrecise(amount)}</span>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", highlight && "font-medium text-emerald-600 dark:text-emerald-400")}>
        {value}
      </span>
    </div>
  );
}

export function RequestCostBreakdown({ data, className }: { data: CostBreakdownInput; className?: string }) {
  const lines = buildLines(data.tokens);
  const ratio = num(data.routeRatio);

  const platformAmount = (key: keyof SixUnit, tokens: number): number | null => {
    const snap = data.costAmount ? num(data.costAmount[key]) : null;
    return snap != null ? snap : computeAmount(data.costUnit[key], tokens);
  };
  const userAmount = (key: keyof SixUnit, tokens: number): number | null =>
    computeAmount(data.priceUnit[key], tokens);

  const snapTotal = data.costAmount ? num(data.costAmount.total) : null;
  const platformTotal =
    snapTotal != null ? snapTotal : lines.reduce((s, l) => s + (platformAmount(l.key, l.tokens) ?? 0), 0);
  const userTotal = lines.reduce((s, l) => s + (userAmount(l.key, l.tokens) ?? 0), 0);

  const margin = platformTotal != null ? userTotal - platformTotal : null;
  const marginRate = margin != null && userTotal > 0 ? margin / userTotal : null;

  const baseInput = ratio != null && ratio > 0 ? (num(data.priceUnit.uncachedInput) ?? 0) / ratio : null;
  const baseOutput = ratio != null && ratio > 0 ? (num(data.priceUnit.output) ?? 0) / ratio : null;

  if (lines.length === 0) {
    return <p className="text-muted-foreground text-xs">无计费用量</p>;
  }

  return (
    <div className={cn("flex flex-col gap-3 text-xs", className)}>
      <section className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">平台成本</span>
        <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
          {lines.map((l) => (
            <CalcRow key={l.key} label={l.label} unit={data.costUnit[l.key]} tokens={l.tokens} amount={platformAmount(l.key, l.tokens)} />
          ))}
          <TotalRow label="总成本" amount={platformTotal} />
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">用户价格</span>
        <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
          {lines.map((l) => (
            <CalcRow key={l.key} label={l.label} unit={data.priceUnit[l.key]} tokens={l.tokens} amount={userAmount(l.key, l.tokens)} />
          ))}
          <TotalRow label="总价格" amount={userTotal} />
        </div>
      </section>

      <section className="flex flex-col gap-1 border-t pt-2">
        <SummaryRow
          label="模型基准价"
          value={
            baseInput != null || baseOutput != null
              ? `输入 ${formatUSDPrecise(baseInput)} / 输出 ${formatUSDPrecise(baseOutput)} · /1M`
              : "—"
          }
        />
        <SummaryRow label="线路倍率" value={ratio != null ? `× ${trimDecimal(String(data.routeRatio))}` : "—"} />
        <SummaryRow
          label="毛利"
          value={margin != null ? `${formatUSDPrecise(margin)}${marginRate != null ? ` · ${formatPercent(marginRate)}` : ""}` : "—"}
          highlight
        />
        {data.userCharge != null && data.userCharge !== "" && (
          <SummaryRow label="实际扣费" value={formatUSDPrecise(data.userCharge)} />
        )}
      </section>
    </div>
  );
}
