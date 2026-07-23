import { useEffect, useState } from "react";
import {
  CircleAlertIcon,
  CircleHelpIcon,
  ZapOffIcon,
  ZapIcon,
} from "lucide-react";
import type { ChannelBreakerSnapshot } from "@/lib/api/channelsOps";
import type { RuntimeSyncState } from "@/lib/api/runtime";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 把 observed_at + open_remaining_ms 换成仍在走的剩余毫秒（可到 0）。 */
export function remainingOpenMs(
  breaker: ChannelBreakerSnapshot,
  nowMs: number,
): number | null {
  if (breaker.state !== "open") return null;
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

const RUNTIME_STATE_COPY: Record<
  Exclude<RuntimeSyncState, "active">,
  { label: string; description: string }
> = {
  runtime_sync_pending: {
    label: "运行态同步中",
    description: "数据库变更已保存，Redis 新版本尚未确认提交，新准入保持拒绝。",
  },
  runtime_sync_required: {
    label: "运行态待恢复",
    description: "Redis control 缺失或尚未建立，新准入保持拒绝。",
  },
  stale: {
    label: "运行态版本过期",
    description: "Redis 与数据库版本不一致，旧 breaker 快照不作为当前事实展示。",
  },
  store_unavailable: {
    label: "运行态基础设施故障",
    description: "Redis/BreakerStore 当前不可用，新的上游准入已拒绝。",
  },
  runtime_state_lost: {
    label: "运行态完整性丢失",
    description: "完整性 epoch 尚未恢复并通过对账，新的上游准入已拒绝。",
  },
};

export function channelRuntimeStateLabel(
  state: RuntimeSyncState | undefined,
): string | null {
  if (!state || state === "active") return null;
  return RUNTIME_STATE_COPY[state].label;
}

/**
 * 渠道名后熔断图标。缺失运行态使用中性的“无样本”，不能伪装成 closed。
 */
export function ChannelCircuitBreakerBadge({
  breaker,
  runtimeSyncState,
}: {
  breaker?: ChannelBreakerSnapshot | null;
  runtimeSyncState?: RuntimeSyncState;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (breaker?.state !== "open") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [breaker?.state, breaker?.observed_at, breaker?.open_remaining_ms]);

  if (runtimeSyncState && runtimeSyncState !== "active") {
    const copy = RUNTIME_STATE_COPY[runtimeSyncState];
    return (
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            title={copy.label}
            aria-label={copy.label}
            className="text-destructive inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5"
            onClick={(event) => event.preventDefault()}
          >
            <CircleAlertIcon />
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-72 text-xs">
          <div className="font-medium">{copy.label}</div>
          <p className="text-muted-foreground mt-1">{copy.description}</p>
        </HoverCardContent>
      </HoverCard>
    );
  }

  if (!breaker || !breaker.exists) {
    const title = "无熔断运行样本";
    return (
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            title={title}
            aria-label={title}
            className="text-muted-foreground inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5"
            onClick={(event) => event.preventDefault()}
          >
            <CircleHelpIcon />
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-64 text-xs">
          运行态数据源未返回该渠道的熔断样本，当前状态不能推断为闭合。
        </HoverCardContent>
      </HoverCard>
    );
  }

  const status = breaker;
  const remaining = remainingOpenMs(status, now);

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
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm [&_svg]:size-3.5",
            isOpen
              ? "text-destructive"
              : isHalfOpen
                ? "text-muted-foreground"
                : "text-foreground",
          )}
          onClick={(e) => e.preventDefault()}
        >
          <Icon strokeWidth={2.25} />
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
            <dt className="text-muted-foreground">窗口样本</dt>
            <dd>
              成功 {status.eligible_successes} / 失败 {status.eligible_failures}
              {status.sample_count > 0
                ? `（失败率 ${(status.error_rate * 100).toFixed(0)}%）`
                : "（暂无样本）"}
            </dd>
            <dt className="text-muted-foreground">连续失败</dt>
            <dd>{status.consecutive_failures}</dd>
            {status.ttft_samples > 0 ? (
              <>
                <dt className="text-muted-foreground">流式 TTFT</dt>
                <dd>
                  {Math.round(status.ttft_ewma_ms)} ms（{status.ttft_samples} 样本）
                </dd>
              </>
            ) : null}
            {status.observed_at ? (
              <>
                <dt className="text-muted-foreground">快照时间</dt>
                <dd>{formatDateTime(status.observed_at)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
