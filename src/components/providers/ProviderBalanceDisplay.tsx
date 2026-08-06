import { Badge } from "@/components/ui/badge";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProviderBalanceStatus } from "@/lib/api/providersOps";

const STATUS_LABEL: Record<ProviderBalanceStatus, string> = {
  unconfigured: "未设置",
  normal: "正常",
  low: "余额较低",
  negative: "负余额",
};

export function ProviderBalanceDisplay({
  balance,
  status,
  compact = false,
}: {
  balance: string | null;
  status: ProviderBalanceStatus;
  compact?: boolean;
}) {
  if (status === "unconfigured" || balance == null) {
    return <span className="text-muted-foreground">未设置</span>;
  }

  const warning = status === "low";
  const danger = status === "negative";
  return (
    <div className={cn("flex min-w-0 items-center gap-2", !compact && "flex-wrap")}>
      <span
        className={cn(
          "font-medium tabular-nums",
          warning && "text-amber-600 dark:text-amber-400",
          danger && "text-destructive",
        )}
      >
        {formatUSD(balance)}
      </span>
      {status !== "normal" ? (
        <Badge variant={danger ? "destructive" : "outline"} className="whitespace-nowrap">
          {STATUS_LABEL[status]}
        </Badge>
      ) : null}
    </div>
  );
}
