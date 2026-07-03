import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttemptSuccessTip } from "@/components/dashboard/AttemptSuccessTip";
import { rateIntent } from "@/components/dashboard/metrics";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

function rateTextClass(rate: number): string {
  const intent = rateIntent(rate);
  return intent === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : intent === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";
}

export function AttemptSuccessRateCell({
  attemptTotal,
  attemptSucceeded,
  successRate,
  className,
}: {
  attemptTotal: number;
  attemptSucceeded: number;
  successRate: number;
  className?: string;
}) {
  if (attemptTotal <= 0) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>—</span>;
  }

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-default tabular-nums underline decoration-dotted underline-offset-2",
            rateTextClass(successRate),
            className,
          )}
        >
          {formatPercent(successRate)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="end">
        <AttemptSuccessTip
          attemptTotal={attemptTotal}
          attemptSucceeded={attemptSucceeded}
          successRate={successRate}
        />
      </TipHoverCardContent>
    </HoverCard>
  );
}
