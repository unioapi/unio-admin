import type { CacheStats, TokenStats } from "@/lib/api/dashboard";
import { formatCompact, formatInt, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function Row({
  label,
  value,
  indent,
  emphasis,
}: {
  label: string;
  value: number;
  indent?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={cn(
          indent ? "text-muted-foreground pl-5 text-[11px]" : "text-xs",
          emphasis && "font-medium text-foreground",
        )}
        title={formatInt(value)}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          indent ? "text-muted-foreground text-[11px]" : "text-xs",
          emphasis ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {formatCompact(value)}
      </span>
    </div>
  );
}

/** Token 总量卡片悬浮详情：输入分项（含缓存）/ 输出 / 总计。 */
export function TokenTip({
  tokens,
  cache,
}: {
  tokens: TokenStats;
  cache: CacheStats;
}) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">Token 总量</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            输入（含缓存）+ 输出
          </div>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          缓存占比 {formatPercent(cache.read_rate)}
        </Badge>
      </div>

      <div className="flex flex-col">
        <Row label="输入" value={tokens.input} emphasis />
        <Row label="未缓存" value={cache.uncached_tokens} indent />
        <Row label="缓存读取" value={cache.cache_read_tokens} indent />
        <Row label="缓存写入 5m" value={cache.cache_write_5m_tokens} indent />
        <Row label="缓存写入 1h" value={cache.cache_write_1h_tokens} indent />
        <Row label="缓存写入 30m" value={cache.cache_write_30m_tokens} indent />
        <Row label="输出" value={tokens.output} emphasis />
        <div className="mt-1 flex items-center justify-between gap-3 border-t py-1.5">
          <span className="text-xs font-semibold text-foreground">总计</span>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {formatCompact(tokens.total)}
          </span>
        </div>
      </div>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        输入 = 未缓存 + 缓存读取 + 缓存写入；缓存占比 = 缓存 token ÷ 输入 token。区间内成功结算请求汇总。
      </p>
    </div>
  );
}

/** 卡片副栏：输入 · 输出。 */
export function TokenHint({ tokens }: { tokens: TokenStats }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 tabular-nums">
      <span className="truncate">输入 {formatCompact(tokens.input)}</span>
      <span className="truncate text-right">输出 {formatCompact(tokens.output)}</span>
    </div>
  );
}
