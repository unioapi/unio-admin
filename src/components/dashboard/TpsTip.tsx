import { formatCompact, formatTPS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// 生成耗时（秒）人性化展示：<60 用 s，<3600 用 m，否则 h。
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function Row({
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

/** 平均 TPS 卡片悬浮详情：输出 token 速度 = 输出 ÷ 生成耗时。 */
export function TpsTip({ tps, output }: { tps: number; output: number }) {
  // tps = output / 生成耗时 → 生成耗时 = output / tps（精确反推）。
  const generationSeconds = tps > 0 ? output / tps : 0;

  return (
    <div className="flex w-64 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">平均 TPS</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            输出 token 每秒生成速度
          </div>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {formatTPS(tps)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <Row label="平均 TPS" value={formatTPS(tps)} emphasis />
        <Row label="输出 token" value={formatCompact(output)} />
        <Row label="生成耗时" value={formatDuration(generationSeconds)} />
      </div>

      <Separator />

      <div className="bg-muted/30 rounded-md px-2.5 py-2">
        <p className="text-foreground font-mono text-[10px] leading-relaxed">
          TPS = 输出 token ÷ 生成耗时
        </p>
      </div>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        生成耗时为成功请求「首 token 之后」的输出阶段累计时长；缺 TTFT 时退回发起时刻。
      </p>
    </div>
  );
}

/** 卡片副栏：输出 token。 */
export function TpsHint({ output }: { output: number }) {
  return <span className="truncate">输出 {formatCompact(output)} token</span>;
}
