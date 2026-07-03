import { formatInt } from "@/lib/format";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

function formatRpmLimit(v: number | null | undefined): string {
  if (v == null) return "默认";
  if (v === 0) return "不限";
  return formatInt(v);
}

function rateLimitDetail(v: number | null | undefined): string {
  if (v == null) return "继承全局默认";
  if (v === 0) return "不限";
  return formatInt(v);
}

export function RateLimitSummaryCell({
  rpm,
  tpm,
  rpd,
  scopeLabel = "限流",
}: {
  rpm: number | null | undefined;
  tpm: number | null | undefined;
  rpd: number | null | undefined;
  scopeLabel?: string;
}) {
  if (rpm == null && tpm == null && rpd == null) {
    return <span className="text-muted-foreground text-xs">默认</span>;
  }
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-default text-xs tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {formatRpmLimit(rpm)}
        </span>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-64">
        <p className="text-muted-foreground mb-1.5 text-xs font-medium">{scopeLabel}</p>
        <ul className="flex flex-col gap-1 text-xs">
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每分钟请求 RPM</span>
            <span className="tabular-nums">{rateLimitDetail(rpm)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每分钟 Token TPM</span>
            <span className="tabular-nums">{rateLimitDetail(tpm)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每日请求 RPD</span>
            <span className="tabular-nums">{rateLimitDetail(rpd)}</span>
          </li>
        </ul>
        <p className="text-muted-foreground mt-1.5 text-[11px]">留空继承全局默认，0 表示不限。</p>
      </TipHoverCardContent>
    </HoverCard>
  );
}
