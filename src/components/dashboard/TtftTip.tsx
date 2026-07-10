import type { ReactNode } from "react";
import type { TtftStats } from "@/lib/api/dashboard";
import type { MetricIntent } from "@/components/common/MetricCard";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ttftIntent, type MetricThresholds } from "@/components/dashboard/metrics";
import { useMetricThresholds } from "@/hooks/useMetricThresholds";

function intentTextClass(intent: MetricIntent): string {
  return intent === "danger"
    ? "text-destructive"
    : intent === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";
}

// 详情内 P95 条着色：健康时显示绿色给出正向读数（与卡片大号中性策略互补）。
function sloBarClass(p95: number, th: MetricThresholds): string {
  if (p95 > th.ttftDangerMs) return "bg-destructive/80";
  if (p95 >= th.ttftWarnMs) return "bg-amber-500/80";
  return "bg-emerald-500/80";
}

const PCT_FIELDS = [
  {
    key: "P50",
    label: "中位数",
    hint: "一半请求比它快，代表典型体感",
    getValue: (t: TtftStats) => t.p50,
  },
  {
    key: "P90",
    label: "第 90 分位",
    hint: "10% 的请求比它慢",
    getValue: (t: TtftStats) => t.p90,
  },
  {
    key: "P95",
    label: "第 95 分位",
    hint: "慢请求尾部，用于 SLO 判定",
    getValue: (t: TtftStats) => t.p95,
    slo: true,
  },
  {
    key: "P99",
    label: "第 99 分位",
    hint: "最慢的 1% 请求",
    getValue: (t: TtftStats) => t.p99,
  },
] as const;

function TipSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border/60 space-y-2 border-t pt-2.5">
      {title ? (
        <h4 className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {title}
        </h4>
      ) : null}
      {children}
    </section>
  );
}

function SummaryRow({
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

/** 分位数横向条：三列 grid（标签 | 条 | 数值），说明与条形图同列对齐。 */
function PercentileBars({ ttft }: { ttft: TtftStats }) {
  const th = useMetricThresholds();
  const max = Math.max(ttft.p50, ttft.p90, ttft.p95, ttft.p99, 1);
  return (
    <div className="space-y-2.5">
      {PCT_FIELDS.map((f) => {
        const value = f.getValue(ttft);
        const slo = "slo" in f && f.slo;
        return (
          <div
            key={f.key}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] gap-x-2 gap-y-0.5"
          >
            <span
              className={cn(
                "self-center text-[11px] leading-none tabular-nums",
                slo ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
              title={f.label}
            >
              {f.key}
            </span>
            <div className="bg-muted/70 h-1.5 self-center overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  slo ? sloBarClass(ttft.p95, th) : "bg-primary/55",
                )}
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "self-center text-right text-[11px] leading-none tabular-nums",
                slo
                  ? cn("font-semibold", intentTextClass(ttftIntent(ttft.p95, th)))
                  : "font-medium",
              )}
            >
              {formatLatencyMs(value)}
            </span>
            <p className="text-muted-foreground col-start-2 col-span-2 text-[10px] leading-snug">
              {f.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** 平均 TTFT 卡片悬浮详情。 */
export function TtftTip({ ttft }: { ttft: TtftStats }) {
  const th = useMetricThresholds();
  if (!ttft.has_data) {
    return (
      <div className="w-full space-y-2">
        <div className="text-sm font-semibold leading-tight">平均 TTFT</div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          暂无首 token 时间数据。仅已开始返回内容（多为流式）的请求会记录{" "}
          <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
            response_started_at
          </code>
          ；历史请求或非流式请求不计入。
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* 顶栏 + 平均值（中性色；告警看 P95 行，避免平均被 P95 阈值误染色） */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">平均 TTFT</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            首 token 延迟（Time To First Token）
          </div>
        </div>
        <div className="font-heading text-foreground text-xl font-semibold tabular-nums">
          {formatLatencyMs(ttft.avg)}
        </div>
      </div>

      {/* 分位数分布 */}
      <TipSection title="分位数分布">
        <PercentileBars ttft={ttft} />
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          P50 即中位数，不受少数极慢请求拉高；卡片主值「平均」易被尾部拖高，看典型体感请对照 P50。
        </p>
      </TipSection>

      {/* 汇总 */}
      <TipSection title="汇总">
        <div className="space-y-1.5">
          <SummaryRow label="平均" value={formatLatencyMs(ttft.avg)} emphasis />
          <SummaryRow label="P50（典型）" value={formatLatencyMs(ttft.p50)} />
          <SummaryRow label="P95（尾部）" value={formatLatencyMs(ttft.p95)} />
          <SummaryRow label="样本" value={formatCompact(ttft.sample)} />
          <SummaryRow label="覆盖率" value={formatPercent(ttft.coverage)} />
        </div>
        <p className="text-muted-foreground pt-1 text-[10px] leading-relaxed">
          覆盖率 = 样本 ÷ 区间总请求；偏低说明多数请求（非流式 / 未完成）未测到首 token，
          平均值仅代表已测样本。
        </p>
      </TipSection>

      {/* 口径 */}
      <TipSection title="口径">
        <div className="bg-muted/30 rounded-md px-2.5 py-2">
          <p className="text-foreground font-mono text-[10px] leading-relaxed">
            TTFT = response_started_at − started_at
          </p>
        </div>
        <div className="bg-muted/30 mt-2 flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[11px]">
          <span className="text-muted-foreground">P95 阈值</span>
          <span className="tabular-nums">
            <span className="text-amber-600 dark:text-amber-400">
              注意 ≥ {formatLatencyMs(th.ttftWarnMs)}
            </span>
            {" · "}
            <span className="text-destructive">异常 &gt; {formatLatencyMs(th.ttftDangerMs)}</span>
          </span>
        </div>
      </TipSection>

      {/* 字段说明 */}
      <TipSection title="字段说明">
        <ul className="space-y-2">
          <li className="space-y-0.5">
            <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
              response_started_at
            </code>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              网关收到上游首个内容 token 的时刻；非流式响应通常不写入。
            </p>
          </li>
          <li className="space-y-0.5">
            <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
              sample
            </code>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              区间内测到首 token 的请求数，即分位 / 平均的统计样本量。
            </p>
          </li>
        </ul>
      </TipSection>
    </div>
  );
}

/** 卡片副栏：典型 P50 / 尾部 P95（仅 P95 按 SLO 着色）。 */
export function TtftHint({ ttft }: { ttft: TtftStats }) {
  const th = useMetricThresholds();
  if (!ttft.has_data) return null;
  const p95Intent = ttftIntent(ttft.p95, th);
  return (
    <div className="grid grid-cols-2 gap-x-1.5 tabular-nums">
      <span className="truncate">P50 {formatLatencyMs(ttft.p50)}</span>
      <span className={cn("truncate text-right", intentTextClass(p95Intent))}>
        P95 {formatLatencyMs(ttft.p95)}
      </span>
    </div>
  );
}
