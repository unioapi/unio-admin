import type { ApiKeysOpsSummary } from "@/lib/api/customerOps";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "font-heading mt-0.5 text-base font-semibold tabular-nums",
          className,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ApiKeysOverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-md" />
      ))}
    </div>
  );
}

export function ApiKeysOverviewStats({ summary }: { summary: ApiKeysOpsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="Key 总数" value={formatInt(summary.key_total)} />
      <Stat label="启用 Key" value={formatInt(summary.key_enabled)} />
      <Stat
        label="已达上限"
        value={formatInt(summary.spend_capped)}
        className={
          summary.spend_capped > 0 ? "text-amber-600 dark:text-amber-400" : undefined
        }
      />
    </div>
  );
}
