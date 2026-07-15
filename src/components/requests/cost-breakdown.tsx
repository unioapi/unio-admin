import type { ReactNode } from "react";
import { formatInt, formatPercent, formatUSDPrecise, trimDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

// 费用明细：四块 —— 用户价格 / 渠道成本 / 毛利 / 摘要。
// token↔金额口径与后端一致：普通输出 = 输出总数 − 推理输出；推理单价未配置时回退到输出价。

type Num = string | null | undefined;

export interface SixUnit {
  uncachedInput: Num;
  cacheRead: Num;
  cacheWrite5m: Num;
  cacheWrite1h: Num;
  cacheWrite30m: Num;
  output: Num;
  reasoning: Num;
}

interface SixAmount extends SixUnit {
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
  costUnit: SixUnit;
  priceUnit: SixUnit;
  costAmount?: SixAmount | null;
  userCharge?: Num;
  routeRatio?: Num;
  channelCostMultiplier?: Num;
  rechargeFactor?: Num;
  longContextApplied?: boolean;
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

/** 推理等可选分项：未配置单价时回退到输出单价（与 billing normalizeTokenRates 一致）。 */
function effectiveUnit(
  unit: Num,
  fallback: Num,
): { display: Num; fallbackUsed: boolean } {
  if (num(unit) != null) return { display: unit, fallbackUsed: false };
  if (num(fallback) != null) return { display: fallback, fallbackUsed: true };
  return { display: null, fallbackUsed: false };
}

interface LineDef {
  key: keyof SixUnit;
  label: string;
  tokens: number;
  /** 未配置时回退到该 key 的单价（通常为 output）。 */
  fallbackKey?: keyof SixUnit;
}

function buildLines(t: CostBreakdownInput["tokens"]): LineDef[] {
  const normalOutput = Math.max(0, t.outputTotal - t.reasoningOutput);
  return (
    [
      { key: "uncachedInput", label: "输入", tokens: t.uncachedInput },
      { key: "cacheRead", label: "缓存读取", tokens: t.cacheRead, fallbackKey: "uncachedInput" },
      { key: "cacheWrite5m", label: "缓存写入·5m", tokens: t.cacheWrite5m, fallbackKey: "uncachedInput" },
      { key: "cacheWrite1h", label: "缓存写入·1h", tokens: t.cacheWrite1h, fallbackKey: "uncachedInput" },
      { key: "cacheWrite30m", label: "缓存写入·30m", tokens: t.cacheWrite30m, fallbackKey: "uncachedInput" },
      { key: "output", label: "输出", tokens: normalOutput },
      { key: "reasoning", label: "推理输出", tokens: t.reasoningOutput, fallbackKey: "output" },
    ] as LineDef[]
  ).filter((l) => l.tokens > 0);
}

function unitLabel(unit: Num, fallbackUsed: boolean, fallbackHint: string): string {
  const u = num(unit);
  if (u == null) return "—";
  const base = `$${trimDecimal(String(unit))}/1M`;
  return fallbackUsed ? `${base}·${fallbackHint}` : base;
}

function CalcRow({
  label,
  unit,
  tokens,
  amount,
  fallbackUsed,
  fallbackHint,
}: {
  label: string;
  unit: Num;
  tokens: number;
  amount: number | null;
  fallbackUsed?: boolean;
  fallbackHint?: string;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] items-baseline gap-x-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span
        className="text-muted-foreground/80 min-w-0 truncate font-mono text-[10px]"
        title={unitLabel(unit, !!fallbackUsed, fallbackHint ?? "回退")}
      >
        {unitLabel(unit, !!fallbackUsed, fallbackHint ?? "回退")}
      </span>
      <span className="text-muted-foreground/70 font-mono text-[10px] tabular-nums">
        × {formatInt(tokens)}
      </span>
      <span className="min-w-[4.5rem] text-right tabular-nums">
        {formatUSDPrecise(amount)}
      </span>
    </div>
  );
}

function TotalRow({ label, amount }: { label: string; amount: number | null }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-dashed pt-1.5 font-medium">
      <span>{label}</span>
      <span className="tabular-nums">{formatUSDPrecise(amount)}</span>
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right tabular-nums">{children}</div>
    </div>
  );
}

function Block({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <h4 className="text-muted-foreground text-[11px] font-medium tracking-wide">
        {title}
      </h4>
      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2.5 py-2">
        {children}
      </div>
    </section>
  );
}

function BasePricePair({ input, output }: { input: number | null; output: number | null }) {
  if (input == null && output == null) return <span>—</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5">
      <span>
        <span className="text-muted-foreground mr-1 text-[10px]">输入</span>
        {formatUSDPrecise(input)}
      </span>
      <span>
        <span className="text-muted-foreground mr-1 text-[10px]">输出</span>
        {formatUSDPrecise(output)}
      </span>
      <span className="text-muted-foreground text-[10px]">/1M</span>
    </span>
  );
}

export function RequestCostBreakdown({
  data,
  className,
}: {
  data: CostBreakdownInput;
  className?: string;
}) {
  const lines = buildLines(data.tokens);
  const ratio = num(data.routeRatio);

  const lineUnit = (units: SixUnit, line: LineDef) => {
    const fallback = line.fallbackKey ? units[line.fallbackKey] : null;
    return effectiveUnit(units[line.key], fallback);
  };

  const platformAmount = (line: LineDef): number | null => {
    const snap = data.costAmount ? num(data.costAmount[line.key]) : null;
    if (snap != null) return snap;
    const { display } = lineUnit(data.costUnit, line);
    return computeAmount(display, line.tokens);
  };
  const userAmount = (line: LineDef): number | null => {
    const { display } = lineUnit(data.priceUnit, line);
    return computeAmount(display, line.tokens);
  };

  const snapTotal = data.costAmount ? num(data.costAmount.total) : null;
  const platformTotal =
    snapTotal != null
      ? snapTotal
      : lines.reduce((s, l) => s + (platformAmount(l) ?? 0), 0);
  const userTotal = lines.reduce((s, l) => s + (userAmount(l) ?? 0), 0);

  const margin = platformTotal != null ? userTotal - platformTotal : null;
  const marginRate = margin != null && userTotal > 0 ? margin / userTotal : null;

  // 售价侧：模型基准价 = 客户售价 ÷ 线路倍率
  const baseInput =
    ratio != null && ratio > 0 ? (num(data.priceUnit.uncachedInput) ?? 0) / ratio : null;
  const baseOutput =
    ratio != null && ratio > 0 ? (num(data.priceUnit.output) ?? 0) / ratio : null;

  // 成本侧：成本基数 = 成本单价 ÷ (价格倍率 × 充值倍率)
  const priceMult = num(data.channelCostMultiplier);
  const rechargeMult = num(data.rechargeFactor);
  const combined =
    priceMult != null ? priceMult * (rechargeMult != null ? rechargeMult : 1) : null;
  const hasCostSource = priceMult != null || rechargeMult != null;
  const refInput =
    combined != null && combined > 0
      ? (num(data.costUnit.uncachedInput) ?? 0) / combined
      : null;
  const refOutput =
    combined != null && combined > 0
      ? (num(data.costUnit.output) ?? 0) / combined
      : null;

  if (lines.length === 0) {
    return <p className="text-muted-foreground text-xs">无计费用量</p>;
  }

  const fallbackHintFor = (line: LineDef) =>
    line.fallbackKey === "output" ? "同输出" : "同输入";

  return (
    <div className={cn("flex flex-col gap-3 text-xs", className)}>
      {/* 1. 用户价格：线路倍率 + 模型基准价 + 分项计算 */}
      <Block title="用户价格">
        <div className="mb-1.5 flex flex-col gap-1 border-b border-dashed pb-1.5">
          <MetaRow label="模型基准价">
            <BasePricePair input={baseInput} output={baseOutput} />
          </MetaRow>
          <MetaRow label="线路倍率">
            {ratio != null ? `× ${trimDecimal(String(data.routeRatio))}` : "—"}
          </MetaRow>
          {data.longContextApplied ? (
            <MetaRow label="长上下文">
              <span className="text-amber-700 dark:text-amber-400">已应用（入×2 / 出×1.5）</span>
            </MetaRow>
          ) : null}
        </div>
        {lines.map((l) => {
          const { display, fallbackUsed } = lineUnit(data.priceUnit, l);
          return (
            <CalcRow
              key={`price-${l.key}`}
              label={l.label}
              unit={display}
              tokens={l.tokens}
              amount={userAmount(l)}
              fallbackUsed={fallbackUsed}
              fallbackHint={fallbackHintFor(l)}
            />
          );
        })}
        <TotalRow label="合计" amount={userTotal} />
      </Block>

      {/* 2. 渠道成本：成本基数 + 倍率快照 + 分项计算 */}
      <Block title="渠道成本">
        {hasCostSource ? (
          <div className="mb-1.5 flex flex-col gap-1 border-b border-dashed pb-1.5">
            <MetaRow label="成本基数">
              <BasePricePair input={refInput} output={refOutput} />
            </MetaRow>
            <MetaRow label="价格倍率">
              {priceMult != null
                ? `× ${trimDecimal(String(data.channelCostMultiplier))}`
                : "—"}
            </MetaRow>
            <MetaRow label="充值倍率">
              {rechargeMult != null
                ? `× ${trimDecimal(String(data.rechargeFactor))}`
                : "× 1（未配置）"}
            </MetaRow>
          </div>
        ) : (
          <p className="text-muted-foreground mb-1.5 border-b border-dashed pb-1.5 text-[10px]">
            绝对覆盖或历史请求：无倍率快照，以下为落库成本单价。
          </p>
        )}
        {lines.map((l) => {
          const { display, fallbackUsed } = lineUnit(data.costUnit, l);
          return (
            <CalcRow
              key={`cost-${l.key}`}
              label={l.label}
              unit={display}
              tokens={l.tokens}
              amount={platformAmount(l)}
              fallbackUsed={fallbackUsed}
              fallbackHint={fallbackHintFor(l)}
            />
          );
        })}
        <TotalRow label="合计" amount={platformTotal} />
      </Block>

      {/* 3. 毛利 */}
      <Block title="毛利">
        <MetaRow label="毛利额">
          <span
            className={cn(
              "font-medium",
              margin != null && margin >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : margin != null
                  ? "text-destructive"
                  : undefined,
            )}
          >
            {formatUSDPrecise(margin)}
          </span>
        </MetaRow>
        <MetaRow label="毛利率">
          {marginRate != null ? formatPercent(marginRate) : "—"}
        </MetaRow>
        <p className="text-muted-foreground pt-0.5 text-[10px] leading-relaxed">
          毛利 = 用户价格合计 − 渠道成本合计
        </p>
      </Block>

      {/* 4. 摘要 */}
      <Block title="摘要">
        <MetaRow label="用户合计">
          <span className="font-medium">{formatUSDPrecise(userTotal)}</span>
        </MetaRow>
        <MetaRow label="渠道合计">{formatUSDPrecise(platformTotal)}</MetaRow>
        <MetaRow label="毛利">
          <span
            className={cn(
              margin != null && margin >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : margin != null
                  ? "text-destructive"
                  : undefined,
            )}
          >
            {margin != null
              ? `${formatUSDPrecise(margin)}${marginRate != null ? ` · ${formatPercent(marginRate)}` : ""}`
              : "—"}
          </span>
        </MetaRow>
        {data.userCharge != null && data.userCharge !== "" && (
          <MetaRow label="实际扣费">
            <span className="font-medium">{formatUSDPrecise(data.userCharge)}</span>
          </MetaRow>
        )}
      </Block>
    </div>
  );
}
