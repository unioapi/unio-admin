import { useEffect, useState } from "react";
import { ZapOffIcon, ZapIcon } from "lucide-react";
import type { ChannelCircuitBreakerStatus } from "@/lib/api/channelsOps";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 把 observed_at + open_remaining_ms 换成仍在走的剩余毫秒（可到 0）。 */
export function remainingOpenMs(
  breaker: ChannelCircuitBreakerStatus,
  nowMs: number,
): number | null {
  if (breaker.state !== "open" || breaker.open_remaining_ms == null) return null;
  const observed = Date.parse(breaker.observed_at);
  if (!Number.isFinite(observed)) return Math.max(0, breaker.open_remaining_ms);
  const deadline = observed + breaker.open_remaining_ms;
  return Math.max(0, deadline - nowMs);
}

/** 倒计时文案：mm:ss（不足 1 小时）或 h:mm:ss。 */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function circuitBreakerStateLabel(state: string): string {
  switch (state) {
    case "open":
      return "熔断中";
    case "half_open":
      return "半开探测";
    case "closed":
      return "闭合";
    default:
      return state;
  }
}

function stateLabel(state: string): string {
  return circuitBreakerStateLabel(state);
}

const DEFAULT_CLOSED: ChannelCircuitBreakerStatus = {
  state: "closed",
  failures: 0,
  successes: 0,
  half_open_in_flight: false,
  health_score: 0,
  observed_at: "",
};

/**
 * 渠道名后熔断图标：始终显示。
 * closed=绿 / half_open=琥珀 / open=红。
 */
export function ChannelCircuitBreakerBadge({
  breaker,
}: {
  breaker?: ChannelCircuitBreakerStatus | null;
}) {
  const status = breaker ?? DEFAULT_CLOSED;
  const [now, setNow] = useState(() => Date.now());
  const remaining = remainingOpenMs(status, now);

  useEffect(() => {
    if (status.state !== "open") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status.state, status.observed_at, status.open_remaining_ms]);

  const isOpen = status.state === "open";
  const isHalfOpen = status.state === "half_open";
  const Icon = isOpen ? ZapOffIcon : ZapIcon;
  const title = isOpen
    ? remaining != null && remaining > 0
      ? `熔断中 · 剩余 ${formatCountdown(remaining)}`
      : "熔断中 · 即将半开探测"
    : isHalfOpen
      ? "半开探测中"
      : "熔断闭合 · 正常";

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={title}
          className={cn(
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm",
            isOpen
              ? "text-destructive"
              : isHalfOpen
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400",
          )}
          onClick={(e) => e.preventDefault()}
        >
          <Icon className="size-3.5" strokeWidth={2.25} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 text-xs">
        <div className="space-y-2">
          <div className="font-medium">渠道熔断</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">状态</dt>
            <dd>{stateLabel(status.state)}</dd>
            {isOpen ? (
              <>
                <dt className="text-muted-foreground">打开剩余</dt>
                <dd className="font-mono tabular-nums">
                  {remaining != null && remaining > 0
                    ? formatCountdown(remaining)
                    : "0:00（即将半开探测）"}
                </dd>
              </>
            ) : null}
            {isHalfOpen ? (
              <>
                <dt className="text-muted-foreground">探测中</dt>
                <dd>
                  {status.half_open_in_flight ? "是（已有探测在飞）" : "否（等待探测）"}
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">窗口样本</dt>
            <dd>
              成功 {status.successes} / 失败 {status.failures}
              {status.successes + status.failures > 0
                ? `（失败率 ${(
                    (status.failures / (status.successes + status.failures)) *
                    100
                  ).toFixed(0)}%）`
                : status.state === "open" || status.state === "half_open"
                  ? "（跳闸后计数已清零）"
                  : "（暂无样本）"}
            </dd>
            {status.opened_at ? (
              <>
                <dt className="text-muted-foreground">打开于</dt>
                <dd>{formatDateTime(status.opened_at)}</dd>
              </>
            ) : null}
            {status.observed_at ? (
              <>
                <dt className="text-muted-foreground">快照时间</dt>
                <dd>{formatDateTime(status.observed_at)}</dd>
              </>
            ) : null}
          </dl>
          {status.instances && status.instances.length > 1 ? (
            <div className="border-t pt-2">
              <div className="text-muted-foreground mb-1">各实例</div>
              <ul className="space-y-1">
                {status.instances.map((inst) => (
                  <li key={inst.id} className="flex justify-between gap-2 font-mono">
                    <span className="truncate">{inst.id}</span>
                    <span className="shrink-0">{stateLabel(inst.state)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
