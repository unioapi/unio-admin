import type { ReactNode } from "react";
import {
  CheckCircle2Icon,
  CircleXIcon,
} from "lucide-react";
import type {
  RouteRuntimeChannel,
  RouteRuntimeEligibilityCheck,
  RouteRuntimeScoreComponent,
} from "@/lib/api/routesOps";
import { formatInt, formatLatencyMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ELIGIBILITY_LABELS: Record<string, string> = {
  route: "线路状态",
  provider: "服务商状态",
  channel: "渠道状态",
  margin: "毛利",
  provider_breaker: "服务商熔断",
  channel_breaker: "渠道熔断",
  cooldown: "429 冷却",
  model_permission: "模型权限",
  runtime: "运行态同步",
};

const REASON_LABELS: Record<string, string> = {
  cooldown: "处于 429 冷却",
  model_permission_paused: "模型权限暂停",
  negative_margin: "毛利不满足要求",
  provider_breaker_open: "服务商熔断已打开",
  channel_breaker_open: "渠道熔断已打开",
  not_in_candidate_plan: "未进入本次候选计划",
  runtime_sync_pending: "运行态同步中",
  runtime_sync_required: "运行态尚未建立",
  stale: "运行态版本落后",
};

const RUNTIME_LABELS: Record<string, string> = {
  active: "已同步",
  stale: "版本落后",
  runtime_sync_pending: "同步中",
  runtime_sync_required: "待同步",
  store_unavailable: "共享运行态不可用",
  runtime_state_lost: "运行态完整性丢失",
};

const SCORE_WEIGHTS = [
  { key: "cost", label: "成本", weight: 25, tone: "bg-sky-500/80" },
  { key: "concurrency", label: "并发", weight: 20, tone: "bg-violet-500/80" },
  { key: "ttft", label: "TTFT", weight: 25, tone: "bg-amber-500/80" },
  { key: "error_rate", label: "错误率", weight: 20, tone: "bg-rose-500/80" },
  { key: "priority", label: "优先级", weight: 10, tone: "bg-emerald-500/80" },
] as const;

export function TipSection({
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

export function TipSummaryRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-foreground" : "font-medium",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TipHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
          {subtitle}
        </div>
      </div>
      {badge}
    </div>
  );
}

function FormulaBox({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30 space-y-1 rounded-md px-2.5 py-2 text-[11px]">
      {children}
    </div>
  );
}

export function reasonLabel(reason: string): string {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (reason.startsWith("route_")) return `线路${reason.slice(6)}`;
  if (reason.startsWith("provider_")) return `服务商${reason.slice(9)}`;
  if (reason.startsWith("channel_")) return `渠道${reason.slice(8)}`;
  return reason;
}

export function formatScore(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function formatPercentPoints(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export { ELIGIBILITY_LABELS, RUNTIME_LABELS };

/** 表头：渠道列 */
export function ChannelColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="渠道"
        subtitle="候选池中的上游入口；顺序越高越靠前被尝试"
      />
      <TipSection title="行内信息">
        <ul className="text-muted-foreground space-y-1.5 text-[11px] leading-relaxed">
          <li>
            <span className="text-foreground/90 font-medium">主行</span>
            ：渠道显示名
          </li>
          <li>
            <span className="text-foreground/90 font-medium">副行</span>
            ：服务商 · 协议 · 配置优先级 P（0 最高，100 最低）
          </li>
        </ul>
      </TipSection>
      <TipSection title="口径">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          配置优先级会进入五项评分中的「优先级」维度（权重 10%）。数值越小，该维得分越高。
        </p>
      </TipSection>
    </div>
  );
}

/** 表头：资格列 */
export function EligibilityColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="候选资格"
        subtitle="硬门槛：未通过则不会进入本次选路"
      />
      <TipSection title="状态含义">
        <div className="space-y-1.5">
          <TipSummaryRow label="有资格" value="可被选中与尝试" tone="ok" />
          <TipSummaryRow label="仅探测" value="可探测，不承担主流量" tone="warn" />
          <TipSummaryRow label="无资格" value="本轮排除出候选集" tone="bad" />
        </div>
      </TipSection>
      <TipSection title="检查项">
        <div className="text-muted-foreground flex flex-wrap gap-1.5 text-[10px]">
          {Object.values(ELIGIBILITY_LABELS).map((label) => (
            <Badge key={label} variant="secondary" className="font-normal">
              {label}
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
          悬浮单元格可查看每项检查的通过/失败原因。毛利、熔断、429 冷却、模型权限与运行态同步任一项失败都会剥夺资格。
        </p>
      </TipSection>
    </div>
  );
}

/** 表头：运行态列 */
export function RuntimeColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="运行态"
        subtitle="数据库配置与共享运行态是否对齐"
      />
      <TipSection title="为何重要">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          选路读写的是共享运行态（熔断、并发、版本修订）。配置已改但运行态未同步时，系统会拒绝新准入，避免按过期事实分流。
        </p>
      </TipSection>
      <TipSection title="常见状态">
        <div className="space-y-1.5">
          <TipSummaryRow label="已同步" value="可正常准入" tone="ok" />
          <TipSummaryRow label="同步中 / 待同步" value="暂缓新准入" tone="warn" />
          <TipSummaryRow label="版本落后 / 不可用" value="不可作为实时事实" tone="bad" />
        </div>
      </TipSection>
    </div>
  );
}

/** 表头：并发列 */
export function ConcurrencyColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="并发占用"
        subtitle="原子硬门槛；满载渠道退出本轮候选"
      />
      <TipSection title="读数">
        <FormulaBox>
          <p className="text-muted-foreground leading-relaxed">
            展示为{" "}
            <span className="text-foreground/90 font-medium">已用 / 上限</span>
            ；进度条为占用比例。上限为「不限」时不触发满载剔除。
          </p>
        </FormulaBox>
      </TipSection>
      <TipSection title="与评分的关系">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          剩余容量越高，并发维指标分越高（权重 20%）。满载是硬剔除，不会只靠低分被排到后面。
        </p>
      </TipSection>
    </div>
  );
}

/** 表头：TTFT 列 */
export function TTFTColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="TTFT"
        subtitle="最近 30 分钟流式样本的平均首字时间"
      />
      <TipSection title="无样本规则">
        <FormulaBox>
          <p className="text-muted-foreground leading-relaxed">
            尚无样本时显示「无样本」，该维按满分计入综合分，避免冷启动渠道被永久压制。
          </p>
        </FormulaBox>
      </TipSection>
      <TipSection title="权重">
        <TipSummaryRow label="TTFT 权重" value="25%" emphasis />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          首字越快，指标分越高。仅统计流式完成样本，与页面下方「评分样本」窗口一致。
        </p>
      </TipSection>
    </div>
  );
}

/** 表头：流量列 */
export function TrafficColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="流量观测"
        subtitle="主值 RPM；不参与拦截，也不进入五项评分"
      />
      <TipSection title="字段">
        <div className="space-y-1.5">
          <TipSummaryRow label="RPM" value="近 1 分钟请求速率" emphasis />
          <TipSummaryRow label="RPD" value="当日累计请求" />
          <TipSummaryRow label="TPM" value="近 1 分钟 token 速率" />
          <TipSummaryRow label="Token 覆盖" value="带用量样本的占比" />
        </div>
      </TipSection>
      <TipSection title="口径">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          这些数字帮助对照「得分排序」与「实际负载」，本身不会因超限而剔除渠道。限流与满载由并发/熔断等硬门槛负责。
        </p>
      </TipSection>
    </div>
  );
}

/** 表头：得分列 */
export function ScoreColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="综合得分"
        subtitle="五项加权总分，决定合格渠道的尝试顺序"
      />
      <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
        {SCORE_WEIGHTS.map((w) => (
          <div
            key={w.key}
            className={cn("h-full", w.tone)}
            style={{ width: `${w.weight}%` }}
            title={`${w.label} ${w.weight}%`}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {SCORE_WEIGHTS.map((w) => (
          <span key={w.key} className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 shrink-0 rounded-full", w.tone)} />
            {w.label} {w.weight}%
          </span>
        ))}
      </div>
      <TipSection title="计算">
        <FormulaBox>
          <p className="text-muted-foreground leading-relaxed">
            每维贡献 = 指标分 × 权重%；总分 = 五维贡献之和。悬浮单元格可看该渠道的逐项拆解。
          </p>
        </FormulaBox>
      </TipSection>
    </div>
  );
}

/** 表头：分流列 */
export function DistributionColumnTip() {
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="实际分流"
        subtitle="近期真实命中占比，用于对照评分排序是否落地"
      />
      <TipSection title="读数">
        <div className="space-y-1.5">
          <TipSummaryRow label="主值" value="近 1 分钟命中占比" emphasis />
          <TipSummaryRow label="详情另含" value="5 分钟占比 · 回退次数" />
        </div>
      </TipSection>
      <TipSection title="怎么读">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          顺序靠前但分流偏低，常见于满载、探测中、粘性会话或短窗波动。回退次数升高说明首选渠道尝试失败后切到了后续候选。
        </p>
      </TipSection>
    </div>
  );
}

/** 单元格：资格 */
export function EligibilityTip({ channel }: { channel: RouteRuntimeChannel }) {
  const eligibility = channel.eligibility;
  const statusLabel =
    eligibility.status === "excluded"
      ? "无资格"
      : eligibility.status === "probe_only"
        ? "仅探测"
        : "有资格";
  const tone =
    eligibility.status === "excluded"
      ? "bad"
      : eligibility.status === "probe_only"
        ? "warn"
        : "ok";
  const passed = eligibility.checks.filter((c) => c.status === "passed").length;
  const failed = eligibility.checks.length - passed;

  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="候选资格"
        subtitle={channel.channel_name}
        badge={
          <Badge
            variant={
              eligibility.status === "excluded"
                ? "destructive"
                : eligibility.status === "probe_only"
                  ? "secondary"
                  : "outline"
            }
          >
            {statusLabel}
          </Badge>
        }
      />

      {eligibility.checks.length > 0 ? (
        <div className="space-y-2">
          <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
            {passed > 0 ? (
              <div
                className="h-full bg-emerald-500/85"
                style={{ width: `${(passed / eligibility.checks.length) * 100}%` }}
              />
            ) : null}
            {failed > 0 ? (
              <div
                className="h-full bg-destructive/75"
                style={{ width: `${(failed / eligibility.checks.length) * 100}%` }}
              />
            ) : null}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500/85" />
              通过 {passed}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-destructive/75" />
              失败 {failed}
            </span>
          </div>
        </div>
      ) : null}

      <TipSection title="检查明细">
        <div className="space-y-1.5">
          {eligibility.checks.map((check) => (
            <EligibilityCheckRow key={check.key} check={check} />
          ))}
        </div>
      </TipSection>

      {eligibility.primary_reason ? (
        <TipSection title="主因">
          <p className={cn("text-[11px] leading-relaxed", tone === "bad" && "text-destructive")}>
            {reasonLabel(eligibility.primary_reason)}
          </p>
        </TipSection>
      ) : null}
    </div>
  );
}

function EligibilityCheckRow({ check }: { check: RouteRuntimeEligibilityCheck }) {
  const passed = check.status === "passed";
  return (
    <div className="flex items-start gap-2 text-xs">
      {passed ? (
        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleXIcon className="text-destructive mt-0.5 size-3.5 shrink-0" />
      )}
      <span className="min-w-0 leading-snug">
        <span className="font-medium">
          {ELIGIBILITY_LABELS[check.key] ?? check.key}
        </span>
        {!passed && check.reason ? (
          <span className="text-muted-foreground">
            {" · "}
            {reasonLabel(check.reason)}
          </span>
        ) : (
          <span className="text-muted-foreground"> · 通过</span>
        )}
      </span>
    </div>
  );
}

/** 单元格：并发 */
export function ConcurrencyTip({ channel }: { channel: RouteRuntimeChannel }) {
  const value = channel.concurrency;
  const usagePct =
    value.unlimited || value.limit <= 0
      ? 0
      : Math.min(100, (value.used / value.limit) * 100);
  const full = !value.unlimited && value.remaining === 0;

  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="并发占用"
        subtitle={channel.channel_name}
        badge={
          <span className="font-heading text-xl font-semibold tabular-nums">
            {formatInt(value.used)}
            <span className="text-muted-foreground text-sm font-medium">
              /{value.unlimited ? "∞" : formatInt(value.limit)}
            </span>
          </span>
        }
      />

      {!value.unlimited ? (
        <div className="space-y-2">
          <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full",
                full ? "bg-destructive/80" : usagePct >= 80 ? "bg-amber-500/80" : "bg-emerald-500/85",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-muted-foreground text-[10px] leading-snug">
            占用 {usagePct.toFixed(0)}%
            {full ? " · 已满载，本轮退出候选集" : " · 未满载，可参与选路"}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          该渠道未设置并发上限，不会因满载被硬剔除。
        </p>
      )}

      <TipSection title="汇总">
        <div className="space-y-1.5">
          <TipSummaryRow
            label="剩余"
            value={value.unlimited ? "不限" : formatInt(value.remaining ?? 0)}
            emphasis
          />
          <TipSummaryRow label="指标分" value={formatScore(value.metric_score)} />
          <TipSummaryRow label="得分贡献" value={formatScore(value.contribution)} />
        </div>
      </TipSection>
      <TipSection title="口径">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          并发是原子硬门槛：满载即剔除。指标分反映剩余容量，按 20% 权重计入综合分。
        </p>
      </TipSection>
    </div>
  );
}

/** 单元格：TTFT */
export function TTFTTip({ channel }: { channel: RouteRuntimeChannel }) {
  const metric = channel.quality.ttft;
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="TTFT"
        subtitle="近 30 分钟流式首字时间"
        badge={
          <span className="font-heading text-xl font-semibold tabular-nums">
            {metric.has_samples ? formatLatencyMs(metric.value) : "—"}
          </span>
        }
      />
      <TipSection title="汇总">
        <div className="space-y-1.5">
          <TipSummaryRow
            label="样本"
            value={metric.has_samples ? `${formatInt(metric.sample_count)} 个` : "无样本"}
            emphasis
          />
          <TipSummaryRow label="指标分" value={formatScore(metric.metric_score)} />
          <TipSummaryRow label="得分贡献" value={formatScore(metric.contribution)} />
        </div>
      </TipSection>
      <TipSection title="口径">
        <FormulaBox>
          <p className="text-muted-foreground leading-relaxed">
            {metric.has_samples
              ? "平均首字时间越短，该维得分越高（权重 25%）。"
              : "无样本按满分计，避免冷启动渠道被永久压低排序。"}
          </p>
        </FormulaBox>
      </TipSection>
    </div>
  );
}

/** 单元格：流量 */
export function TrafficTip({ channel }: { channel: RouteRuntimeChannel }) {
  const traffic = channel.traffic;
  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="流量观测"
        subtitle="只观测，不拦截、不评分"
        badge={
          <span className="font-heading text-xl font-semibold tabular-nums">
            {formatInt(traffic.rpm)}
            <span className="text-muted-foreground text-sm font-medium"> RPM</span>
          </span>
        }
      />
      <TipSection title="汇总">
        <div className="space-y-1.5">
          <TipSummaryRow label="RPM" value={formatInt(traffic.rpm)} emphasis />
          <TipSummaryRow label="RPD" value={formatInt(traffic.rpd)} />
          <TipSummaryRow label="TPM" value={formatInt(traffic.tpm)} />
          <TipSummaryRow
            label="Token 覆盖"
            value={`${formatPercentPoints(traffic.token_coverage_pct)}（${formatInt(traffic.token_covered_attempts)} 次）`}
          />
        </div>
      </TipSection>
      <TipSection title="口径">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          用于对照负载与排序是否匹配。真正的容量门禁看并发与熔断，不看这里的 RPM/TPM。
        </p>
      </TipSection>
    </div>
  );
}

/** 单元格：得分 */
export function ScoreTip({
  channel,
  compact = false,
}: {
  channel: RouteRuntimeChannel;
  compact?: boolean;
}) {
  const parts: Array<[string, RouteRuntimeScoreComponent, string]> = [
    ["成本", channel.score.cost, "bg-sky-500/80"],
    ["并发", channel.score.concurrency, "bg-violet-500/80"],
    ["TTFT", channel.score.ttft, "bg-amber-500/80"],
    ["错误率", channel.score.error_rate, "bg-rose-500/80"],
    ["优先级", channel.score.priority_score, "bg-emerald-500/80"],
  ];
  const total = Math.max(channel.score.total, 0.0001);

  return (
    <div className={cn("w-full", compact ? "space-y-2.5" : "space-y-3")}>
      <TipHeader
        title="综合得分"
        subtitle={
          channel.score.algorithm_version
            ? `算法 ${channel.score.algorithm_version}`
            : "五项加权总分"
        }
        badge={
          <span className="font-heading text-xl font-semibold tabular-nums">
            {formatScore(channel.score.total)}
          </span>
        }
      />

      <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
        {parts.map(([label, part, tone]) => (
          <div
            key={label}
            className={cn("h-full", tone)}
            style={{ width: `${Math.max(0, (part.contribution / total) * 100)}%` }}
            title={`${label} ${formatScore(part.contribution)}`}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {parts.map(([label, part, tone]) => (
		  <div key={label} className="grid grid-cols-[4.5rem_1fr] items-baseline gap-2 text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className={cn("size-1.5 shrink-0 rounded-full", tone)} />
              {label}
            </span>
			<span className="text-right font-medium tabular-nums">
			  {formatScore(part.metric_score)} × {part.weight_pct}% = {formatScore(part.contribution)}
			</span>
          </div>
        ))}
      </div>

      <Separator />
      <div className="flex items-baseline justify-between gap-3 text-xs font-medium tabular-nums">
        <span>总分</span>
        <span>
          {parts.map(([, part]) => formatScore(part.contribution)).join(" + ")} ={" "}
          {formatScore(channel.score.total)}
        </span>
      </div>

      {!compact && channel.score.cost_ratio != null ? (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          成本比 {formatScore(channel.score.cost_ratio)} · 配置优先级 P{channel.score.priority}
        </p>
      ) : null}
    </div>
  );
}

/** 单元格：分流 */
export function DistributionTip({ channel }: { channel: RouteRuntimeChannel }) {
  const d = channel.distribution;
  const share = Math.min(1, Math.max(0, d.selected_share_1m));

  return (
    <div className="w-full space-y-3">
      <TipHeader
        title="实际分流"
        subtitle={channel.channel_name}
        badge={
          <span className="font-heading text-xl font-semibold tabular-nums">
            {formatPercent(d.selected_share_1m)}
          </span>
        }
      />

      <div className="space-y-2">
        <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
          {share > 0 ? (
            <div className="h-full bg-primary/70" style={{ width: `${share * 100}%` }} />
          ) : null}
        </div>
        <p className="text-muted-foreground text-[10px] leading-snug">
          近 1 分钟命中占比；条形相对 100% 总流量。
        </p>
      </div>

      <TipSection title="汇总">
        <div className="space-y-1.5">
          <TipSummaryRow
            label="1 分钟"
            value={`${formatInt(d.selected_1m)} 次 · ${formatPercent(d.selected_share_1m)}`}
            emphasis
          />
          <TipSummaryRow
            label="5 分钟"
            value={`${formatInt(d.selected_5m)} 次 · ${formatPercent(d.selected_share_5m)}`}
          />
          <TipSummaryRow
            label="1 分钟回退"
            value={`${formatInt(d.fallback_1m)} 次`}
            tone={d.fallback_1m > 0 ? "warn" : undefined}
          />
        </div>
      </TipSection>
      <TipSection title="怎么读">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          回退升高通常意味着首选尝试失败后落到后续候选。排序靠前但占比偏低时，优先核对并发满载、资格与粘性会话。
        </p>
      </TipSection>
    </div>
  );
}
