import { formatInt } from "@/lib/format";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

function formatRpmLimit(
  v: number | null | undefined,
  defaultScope?: string,
): string {
  if (v == null) return defaultScope ? `${defaultScope}默认` : "默认";
  if (v === 0) return "不限";
  return formatInt(v);
}

function rateLimitDetail(
  v: number | null | undefined,
  defaultScope?: string,
): string {
  if (v == null) {
    return defaultScope ? `继承${defaultScope}默认限流` : "继承默认限流";
  }
  if (v === 0) return "不限";
  return formatInt(v);
}

function concurrencyDetail(
  v: number | null | undefined,
  defaultScope?: string,
): string {
  if (v == null) {
    return defaultScope ? `继承${defaultScope}默认` : "继承默认";
  }
  if (v === 0) return "不限";
  return formatInt(v);
}

export function RateLimitSummaryCell({
  rpm,
  rpd,
  concurrency,
  scopeLabel = "限流",
  defaultScope,
}: {
  rpm: number | null | undefined;
  rpd: number | null | undefined;
  /** 渠道在途并发；线路级限流无此维时可不传。 */
  concurrency?: number | null;
  scopeLabel?: string;
  defaultScope?: string;
}) {
  const showConcurrency = concurrency !== undefined;
  if (
    rpm == null &&
    rpd == null &&
    (!showConcurrency || concurrency == null)
  ) {
    return (
      <span className="text-muted-foreground text-xs">
        {defaultScope ? `${defaultScope}默认` : "默认"}
      </span>
    );
  }
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-default text-xs tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {formatRpmLimit(rpm, defaultScope)}
        </span>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-64">
        <p className="text-muted-foreground mb-1.5 text-xs font-medium">{scopeLabel}</p>
        <ul className="flex flex-col gap-1 text-xs">
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每分钟请求 RPM</span>
            <span className="tabular-nums">{rateLimitDetail(rpm, defaultScope)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每日请求 RPD</span>
            <span className="tabular-nums">{rateLimitDetail(rpd, defaultScope)}</span>
          </li>
          {showConcurrency ? (
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">并发</span>
              <span className="tabular-nums">
                {concurrencyDetail(concurrency, defaultScope)}
              </span>
            </li>
          ) : null}
        </ul>
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          留空{defaultScope ? `继承${defaultScope}默认限流` : "继承默认限流"}
          {showConcurrency ? "／默认并发" : ""}，0 表示不限。
        </p>
      </TipHoverCardContent>
    </HoverCard>
  );
}
