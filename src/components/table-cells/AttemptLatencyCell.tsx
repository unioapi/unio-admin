import type { LatencyStats } from "@/lib/api/dashboard";
import { LatencyTip } from "@/components/dashboard/LatencyTip";
import { formatLatencyMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

export function AttemptLatencyCell({
  latency,
  className,
}: {
  latency?: LatencyStats;
  className?: string;
}) {
  if (!latency || latency.sample <= 0) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>—</span>;
  }
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-default tabular-nums underline decoration-dotted underline-offset-2",
            className,
          )}
        >
          {formatLatencyMs(latency.avg)}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="end">
        <LatencyTip latency={latency} />
      </TipHoverCardContent>
    </HoverCard>
  );
}
