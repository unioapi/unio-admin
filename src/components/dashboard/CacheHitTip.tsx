import type { ReactNode } from "react";
import type { CacheStats } from "@/lib/api/dashboard";
import { formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cacheWeightTokens } from "@/components/dashboard/metrics";

function segmentWidth(tokens: number, total: number): string {
  if (total <= 0 || tokens <= 0) return "0%";
  return `${(tokens / total) * 100}%`;
}

const CACHE_FIELDS = [
  {
    key: "cache_read",
    getValue: (c: CacheStats) => c.cache_read_tokens,
    meaning: "命中已有 prompt cache（OpenAI → cached_tokens）",
  },
  {
    key: "cache_write_5m",
    getValue: (c: CacheStats) => c.cache_write_5m_tokens,
    meaning: "写入 5 分钟 TTL cache（Anthropic 等）",
  },
  {
    key: "cache_write_1h",
    getValue: (c: CacheStats) => c.cache_write_1h_tokens,
    meaning: "写入 1 小时 TTL cache（Anthropic 等）",
  },
  {
    key: "cache_write_30m",
    getValue: (c: CacheStats) => c.cache_write_30m_tokens,
    meaning: "写入 30 分钟 TTL cache（OpenAI GPT-5.6+）",
  },
] as const;

function TipSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-border/60 space-y-2 border-t pt-2.5", className)}>
      {title ? (
        <h4 className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {title}
        </h4>
      ) : null}
      {children}
    </section>
  );
}

function MonoField({ name }: { name: string }) {
  return (
    <code className="bg-muted/60 text-foreground/90 rounded px-1 py-px font-mono text-[10px]">
      {name}
    </code>
  );
}

/** 竖排公式 + 数值，避免长字段名挤在一行换行。 */
function CacheFormulaBlock({ cache }: { cache: CacheStats }) {
  return (
    <div className="bg-muted/30 overflow-hidden rounded-md">
      <div className="text-muted-foreground border-border/40 border-b px-2.5 py-1.5 text-xs font-medium">
        缓存 token
      </div>
      <div className="space-y-1 px-2.5 py-2 font-mono text-[11px] leading-none">
        {CACHE_FIELDS.map(({ key, getValue }, i) => (
          <div
            key={key}
            className="grid grid-cols-[1rem_minmax(0,1fr)_3.5rem] items-baseline gap-x-2"
          >
            <span className="text-muted-foreground/70 text-right select-none">
              {i === 0 ? "=" : "+"}
            </span>
            <span className="text-muted-foreground truncate">{key}</span>
            <span className="text-foreground text-right tabular-nums font-medium">
              {formatCompact(getValue(cache))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 缓存命中率卡片悬浮详情。 */
export function CacheHitTip({ cache }: { cache: CacheStats }) {
  const input = cache.input_tokens;
  const weight = cacheWeightTokens(cache);
  const writeTotal = cache.cache_write_5m_tokens + cache.cache_write_1h_tokens + cache.cache_write_30m_tokens;

  const readPct = input > 0 ? cache.cache_read_tokens / input : 0;
  const writePct = input > 0 ? writeTotal / input : 0;
  const missPct = input > 0 ? cache.uncached_tokens / input : 0;

  return (
    <div className="w-full space-y-3">
      {/* 顶栏 + 命中率 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">缓存命中</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            缓存 token ÷ 输入 token
          </div>
        </div>
        <div className="font-heading text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          {formatPercent(cache.read_rate)}
        </div>
      </div>

      {/* 比例条 */}
      <div className="space-y-2">
        <div
          className="bg-muted/80 flex h-2 overflow-hidden rounded-full"
          role="img"
          aria-label={`读取 ${Math.round(readPct * 100)}%，未缓存 ${Math.round(missPct * 100)}%`}
        >
          {readPct > 0 ? (
            <div
              className="bg-emerald-500/85 h-full"
              style={{ width: segmentWidth(cache.cache_read_tokens, input) }}
            />
          ) : null}
          {writePct > 0 ? (
            <div
              className="bg-amber-500/85 h-full"
              style={{ width: segmentWidth(writeTotal, input) }}
            />
          ) : null}
          {missPct > 0 ? (
            <div
              className="bg-muted-foreground/20 h-full"
              style={{ width: segmentWidth(cache.uncached_tokens, input) }}
            />
          ) : null}
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          <LegendDot className="bg-emerald-500/85" label={`读取 ${formatCompact(cache.cache_read_tokens)}`} />
          {writeTotal > 0 ? (
            <LegendDot className="bg-amber-500/85" label={`写入 ${formatCompact(writeTotal)}`} />
          ) : null}
          <LegendDot
            className="bg-muted-foreground/20"
            label={`未缓存 ${formatCompact(cache.uncached_tokens)}`}
          />
        </div>
      </div>

      {/* 汇总 */}
      <TipSection title="汇总">
        <dl className="space-y-1.5 text-xs">
          <SummaryRow label="输入 token" value={formatCompact(input)} />
          <SummaryRow label="缓存 token" value={formatCompact(weight)} emphasis />
          <SummaryRow label="未缓存 token" value={formatCompact(cache.uncached_tokens)} />
        </dl>
        <p className="text-muted-foreground pt-1 text-[10px] tabular-nums">
          {formatCompact(weight)} ÷ {formatCompact(input)} = {formatPercent(cache.read_rate)}
        </p>
      </TipSection>

      {/* 缓存 token 构成 */}
      <TipSection title="缓存 token 构成">
        <CacheFormulaBlock cache={cache} />
      </TipSection>

      {/* 字段说明 */}
      <TipSection title="字段说明">
        <ul className="space-y-2.5">
          {CACHE_FIELDS.map(({ key, meaning }) => (
            <li key={key} className="space-y-1">
              <MonoField name={key} />
              <p className="text-muted-foreground pl-0.5 text-[11px] leading-relaxed">
                {meaning}
              </p>
            </li>
          ))}
        </ul>
      </TipSection>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-1.5 shrink-0 rounded-full", className)} />
      {label}
    </span>
  );
}

/** 卡片副栏：输入 / 缓存两列对齐。 */
export function CacheHitHint({ cache }: { cache: CacheStats }) {
  const weight = cacheWeightTokens(cache);
  return (
    <div className="grid grid-cols-2 gap-x-2 tabular-nums">
      <span className="truncate">输入 {formatCompact(cache.input_tokens)}</span>
      <span className="truncate text-right">缓存 {formatCompact(weight)}</span>
    </div>
  );
}
