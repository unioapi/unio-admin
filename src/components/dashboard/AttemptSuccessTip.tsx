import type { ReactNode } from "react";
import { formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SUCCESS_RATE_SLO,
  rateIntent,
} from "@/components/dashboard/metrics";

function rateColor(rate: number): string {
  const intent = rateIntent(rate);
  return intent === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : intent === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";
}

function TipSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border/60 space-y-2 border-t pt-2.5">
      {title ? (
        <h4 className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {title}
        </h4>
      ) : null}
      {children}
    </section>
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
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
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

/** 运维聚合视图：尝试成功率悬浮详情。 */
export function AttemptSuccessTip({
  attemptTotal,
  attemptSucceeded,
  successRate,
}: {
  attemptTotal: number;
  attemptSucceeded: number;
  successRate: number;
}) {
  const attemptFailed = Math.max(0, attemptTotal - attemptSucceeded);
  const successPct = attemptTotal > 0 ? attemptSucceeded / attemptTotal : 0;
  const failedPct = attemptTotal > 0 ? attemptFailed / attemptTotal : 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">成功率</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">成功 ÷（成功 + 失败）</div>
        </div>
        <div className={cn("font-heading text-xl font-semibold tabular-nums", rateColor(successRate))}>
          {formatPercent(successRate)}
        </div>
      </div>

      {attemptTotal > 0 ? (
        <div className="space-y-2">
          <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
            {successPct > 0 ? (
              <div className="h-full bg-emerald-500/85" style={{ width: `${successPct * 100}%` }} />
            ) : null}
            {failedPct > 0 ? (
              <div className="h-full bg-destructive/75" style={{ width: `${failedPct * 100}%` }} />
            ) : null}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500/85" />
              成功 {formatCompact(attemptSucceeded)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-destructive/75" />
              失败 {formatCompact(attemptFailed)}
            </span>
          </div>
        </div>
      ) : null}

      <TipSection title="汇总">
        <div className="space-y-1.5">
          <SummaryRow label="合格尝试（成功 + 失败）" value={formatCompact(attemptTotal)} emphasis />
          <SummaryRow label="成功" value={formatCompact(attemptSucceeded)} />
          <SummaryRow label="失败" value={formatCompact(attemptFailed)} />
        </div>
      </TipSection>

      <TipSection title="比率计算">
        <div className="bg-muted/30 space-y-1.5 rounded-md px-2.5 py-2 text-[11px]">
          <p className="text-muted-foreground leading-relaxed">
            <span className="text-foreground/90 font-medium">成功率</span>
            {" = 成功 ÷（成功 + 失败）"}
          </p>
          <p className="text-foreground font-mono text-[10px] tabular-nums">
            {formatCompact(attemptSucceeded)} ÷ {formatCompact(attemptTotal)} ={" "}
            {formatPercent(successRate)}
          </p>
        </div>
        <div className="bg-muted/30 mt-2 flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[11px]">
          <span className="text-muted-foreground">SLO 参考</span>
          <span className="tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">健康 ≥ {formatPercent(SUCCESS_RATE_SLO)}</span>
          </span>
        </div>
      </TipSection>

      <TipSection title="口径">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          分母为「合格尝试」= 成功 + 失败；不含客户端取消（canceled）与进行中（running），
          与运行时熔断口径一致，避免把客户端取消/在途算作渠道失败。
        </p>
      </TipSection>
    </div>
  );
}
