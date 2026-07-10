import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "lucide-react";
import { formatInt, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Settlement } from "@/components/dashboard/metrics";

function Group({
  title,
  severity,
  deeplink,
  deeplinkLabel,
  children,
}: {
  title: string;
  severity?: { label: string; variant: "destructive" | "secondary" };
  deeplink: string;
  deeplinkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-xs font-medium">{title}</span>
          {severity ? (
            <Badge variant={severity.variant}>{severity.label}</Badge>
          ) : null}
        </div>
        <Button asChild size="xs" variant="ghost">
          <Link to={deeplink}>
            {deeplinkLabel}
            <ArrowUpRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      {children}
    </div>
  );
}

function MetricRow({
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

/** 结算异常卡片悬浮详情：计费异常 + 结算补偿积压，带深链。 */
export function SettlementTip({ settlement }: { settlement: Settlement }) {
  const { billing_exceptions: billing, settlement_backlog: backlog } = settlement;

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <div className="text-sm font-semibold leading-tight">结算异常</div>
        <div className="text-muted-foreground mt-0.5 text-[11px]">
          异常数量 = 计费异常 + 结算失败（补偿中不计入）
        </div>
      </div>

      <Group
        title="计费异常"
        severity={
          billing.total > 0
            ? { label: "注意", variant: "secondary" }
            : undefined
        }
        deeplink="/ledger?tab=exceptions"
        deeplinkLabel="账本"
      >
        <MetricRow label="事件数" value={formatInt(billing.total)} emphasis />
        <MetricRow label="平台承担" value={formatUSD(billing.amount)} />
      </Group>

      <Separator />

      <Group
        title="结算补偿"
        severity={
          backlog.dead > 0
            ? { label: "紧急", variant: "destructive" }
            : undefined
        }
        deeplink="/ledger?tab=recovery"
        deeplinkLabel="结算补偿"
      >
        <MetricRow label="补偿中（自动重试）" value={formatInt(backlog.active)} />
        <MetricRow
          label="已失败（需人工）"
          value={formatInt(backlog.dead)}
          emphasis={backlog.dead > 0}
        />
      </Group>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        计费异常为区间内新增事件；结算补偿为时点积压。补偿中会自动重试，已失败需人工介入。
      </p>
    </div>
  );
}

/** 卡片副栏：平台承担 · 补偿中。 */
export function SettlementHint({ settlement }: { settlement: Settlement }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 tabular-nums">
      <span className="truncate">
        承担 {formatUSD(settlement.billing_exceptions.amount)}
      </span>
      <span className="truncate text-right">
        补偿中 {formatInt(settlement.settlement_backlog.active)}
      </span>
    </div>
  );
}
