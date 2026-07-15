import { useEffect, useState } from "react";
import type { ChannelCircuitBreakerStatus } from "@/lib/api/channelsOps";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatDateTime } from "@/lib/format";

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

function stateLabel(state: string): string {
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

/**
 * 渠道名前熔断徽章：仅 open / half_open 显示；悬浮看详情；打开剩余用倒计时。
 */
export function ChannelCircuitBreakerBadge({
  breaker,
}: {
  breaker: ChannelCircuitBreakerStatus;
}) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = remainingOpenMs(breaker, now);

  useEffect(() => {
    if (breaker.state !== "open") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [breaker.state, breaker.observed_at, breaker.open_remaining_ms]);

  if (breaker.state !== "open" && breaker.state !== "half_open") return null;

  const isOpen = breaker.state === "open";
  const badgeText = isOpen
    ? remaining != null && remaining > 0
      ? `熔断 ${formatCountdown(remaining)}`
      : "熔断 即将探测"
    : "半开";

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Badge
          variant={isOpen ? "destructive" : "secondary"}
          className="h-5 shrink-0 cursor-default px-1.5 text-[10px] tabular-nums"
        >
          {badgeText}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 text-xs">
        <div className="space-y-2">
          <div className="font-medium">渠道熔断</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">状态</dt>
            <dd>{stateLabel(breaker.state)}</dd>
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
            {breaker.state === "half_open" ? (
              <>
                <dt className="text-muted-foreground">探测中</dt>
                <dd>{breaker.half_open_in_flight ? "是（已有探测在飞）" : "否（等待探测）"}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">窗口样本</dt>
            <dd>
              成功 {breaker.successes} / 失败 {breaker.failures}
              {breaker.successes + breaker.failures > 0
                ? `（失败率 ${(
                    (breaker.failures / (breaker.successes + breaker.failures)) *
                    100
                  ).toFixed(0)}%）`
                : "（跳闸后计数已清零）"}
            </dd>
            {breaker.opened_at ? (
              <>
                <dt className="text-muted-foreground">打开于</dt>
                <dd>{formatDateTime(breaker.opened_at)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">快照时间</dt>
            <dd>{formatDateTime(breaker.observed_at)}</dd>
          </dl>
          {breaker.instances && breaker.instances.length > 1 ? (
            <div className="border-t pt-2">
              <div className="text-muted-foreground mb-1">各实例</div>
              <ul className="space-y-1">
                {breaker.instances.map((inst) => (
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
