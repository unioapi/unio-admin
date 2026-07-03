import { formatDateTime, formatLatencySec, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

export interface ChannelLastTestInfo {
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_latency_ms: number | null;
  last_test_error: string | null;
}

export function formatChannelTestLatency(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  return formatLatencySec(ms);
}

export function channelLastTestAutoSizeLabel(info: ChannelLastTestInfo): string {
  if (!info.last_tested_at || info.last_test_ok === null) return "未检测";
  if (info.last_test_ok) {
    const latency = formatChannelTestLatency(info.last_test_latency_ms);
    return latency ? `正常 ${latency}` : "正常";
  }
  return info.last_test_error?.slice(0, 24) || "异常";
}

export function ChannelLastTestDetail({ info }: { info: ChannelLastTestInfo }) {
  if (!info.last_tested_at || info.last_test_ok === null) {
    return (
      <div className="text-muted-foreground rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        该渠道尚未检测过。可在下方发起检测，向真实上游发一个最小请求验证连通性、凭据与模型是否可用。
      </div>
    );
  }

  const latency = formatChannelTestLatency(info.last_test_latency_ms);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={info.last_test_ok ? "default" : "destructive"}>
          {info.last_test_ok ? "正常" : "异常"}
        </Badge>
        {latency ? <span className="text-sm tabular-nums">{latency}</span> : null}
      </div>
      <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
        <span>检测时间：{formatDateTime(info.last_tested_at)}</span>
        <span>相对时间：{formatRelativeTime(info.last_tested_at)}</span>
      </div>
      {!info.last_test_ok && info.last_test_error ? (
        <p className="text-muted-foreground break-words text-sm leading-relaxed">
          {info.last_test_error}
        </p>
      ) : null}
    </div>
  );
}

export function ChannelLastTestCell({ info }: { info: ChannelLastTestInfo }) {
  if (!info.last_tested_at || info.last_test_ok === null) {
    return <span className="text-muted-foreground text-xs">未检测</span>;
  }

  const label = info.last_test_ok ? "正常" : "异常";
  const latency = formatChannelTestLatency(info.last_test_latency_ms);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-left text-xs",
            "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
          )}
        >
          <Badge
            variant={info.last_test_ok ? "secondary" : "destructive"}
            className="h-5 shrink-0 px-1.5 text-[10px]"
          >
            {label}
          </Badge>
          {latency ? <span className="text-muted-foreground tabular-nums">{latency}</span> : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <ChannelLastTestDetail info={info} />
      </TipHoverCardContent>
    </HoverCard>
  );
}
