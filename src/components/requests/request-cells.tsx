import type { ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  HardDriveDownloadIcon,
  HardDriveUploadIcon,
} from "lucide-react";
import type { RequestListItem } from "@/lib/api/requests";
import {
  formatInt,
  formatLatencyMs,
  formatTokenScale,
  formatTPS,
  formatUSDPrecise,
  trimDecimal,
} from "@/lib/format";
import {
  channelBindingLabel,
  resolveStickyMutation,
  resolveStickyOutcome,
  stickyMutationLabel,
  stickyOutcomeLabel,
} from "@/lib/sticky";
import type { MetricThresholds } from "@/components/dashboard/metrics";
import { useMetricThresholds } from "@/hooks/useMetricThresholds";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { Badge } from "@/components/ui/badge";
import { LongContextBadge } from "@/components/common/LongContextBadge";
import { SecretCopyCell, copySecretToClipboard } from "@/components/common/SecretCopyCell";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";
import { RequestCostBreakdown } from "@/components/requests/cost-breakdown";
import { cn } from "@/lib/utils";

const Dash = () => <span className="text-muted-foreground">—</span>;

function ttftClass(ms: number, th: MetricThresholds): string {
  if (ms > th.ttftDangerMs) return "text-red-600 dark:text-red-400";
  if (ms >= th.ttftWarnMs) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

// 悬浮明细中的「标签 · 值」行。
function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("min-w-0 truncate text-right", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

/** 用户/Key：一行显示 #用户ID + key 名（点击复制完整明文 key）。 */
export function RequestUserKeyCell({ row }: { row: RequestListItem }) {
  const name = row.api_key_name || (row.api_key_prefix ? `${row.api_key_prefix}…` : `Key #${row.api_key_id}`);
  const full = row.api_key_plaintext;
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 py-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
        #{row.user_id}
      </span>
      {full ? (
        <button
          type="button"
          title="点击复制完整 API Key"
          className="min-w-0 truncate text-left font-medium underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          onClick={() =>
            copySecretToClipboard(full, { success: "已复制完整 API Key", empty: "无可复制的 Key" })
          }
        >
          {name}
        </button>
      ) : (
        <span className="min-w-0 truncate font-medium">{name}</span>
      )}
    </div>
  );
}

/** 模型：请求模型（悬浮显示显示名 / 提供方 / 请求→响应 / 基准价）。 */
export function RequestModelCell({ row }: { row: RequestListItem }) {
  const req = row.requested_model_id;
  const resp = row.response_model_id;
  const ratio = row.route_price_ratio ? Number(row.route_price_ratio) : null;
  const usableRatio = ratio != null && !Number.isNaN(ratio) && ratio > 0 ? ratio : null;
  const baseInput =
    usableRatio && row.uncached_input_price_unit_usd
      ? Number(row.uncached_input_price_unit_usd) / usableRatio
      : null;
  const baseOutput =
    usableRatio && row.output_price_unit_usd ? Number(row.output_price_unit_usd) / usableRatio : null;
  const hasBase = baseInput != null || baseOutput != null;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex min-w-0 max-w-full flex-col gap-0.5 py-0.5 text-left">
          <span className="truncate font-medium underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
            {req}
          </span>
          {resp && resp !== req && (
            <span className="text-muted-foreground truncate text-[10px]">→ {resp}</span>
          )}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-64">
        <div className="flex flex-col gap-2 text-xs">
          <div className="text-sm font-medium">{row.model_display_name || req}</div>
          <div className="flex flex-col gap-1">
            <Field label="模型 ID" value={req} mono />
            {resp && resp !== req && <Field label="响应模型" value={resp} mono />}
            {row.model_owned_by && <Field label="提供方" value={row.model_owned_by} />}
            <Field
              label="基准价 /1M"
              value={hasBase ? `↓${formatUSDPrecise(baseInput)} · ↑${formatUSDPrecise(baseOutput)}` : "—"}
            />
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

interface TokenLine {
  label: string;
  value: number;
}

function tokenLines(row: RequestListItem): TokenLine[] {
  const normalOutput = Math.max(0, row.output_tokens - row.reasoning_output_tokens);
  return [
    { label: "未缓存输入", value: row.uncached_input_tokens },
    { label: "缓存读取", value: row.cache_read_input_tokens },
    { label: "缓存写入·5m", value: row.cache_write_5m_input_tokens },
    { label: "缓存写入·1h", value: row.cache_write_1h_input_tokens },
    { label: "缓存写入·30m", value: row.cache_write_30m_input_tokens },
    { label: "输出", value: normalOutput },
    { label: "推理输出", value: row.reasoning_output_tokens },
  ].filter((l) => l.value > 0);
}

/** Tokens：主行 未缓存输入/输出（彩色箭头）；有缓存时副行用硬盘图标区分读/写。 */
export function RequestTokensCell({ row }: { row: RequestListItem }) {
  const uncached = row.uncached_input_tokens;
  const output = row.output_tokens;
  const cacheRead = row.cache_read_input_tokens;
  const cacheWrite =
    row.cache_write_5m_input_tokens +
    row.cache_write_1h_input_tokens +
    row.cache_write_30m_input_tokens;
  const inputTotal = uncached + cacheRead + cacheWrite;
  const total = inputTotal + output;

  if (total === 0) return <Dash />;

  const lines = tokenLines(row);
  const hasCache = cacheRead > 0 || cacheWrite > 0;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex flex-col gap-1 py-0.5 text-left text-xs tabular-nums">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400">
              <ArrowDownIcon className="size-3 shrink-0" aria-hidden />
              {formatTokenScale(uncached)}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
              <ArrowUpIcon className="size-3 shrink-0" aria-hidden />
              {formatTokenScale(output)}
            </span>
          </span>
          {hasCache ? (
            <span className="inline-flex items-center gap-1.5 text-[10px]">
              {cacheRead > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                  <HardDriveDownloadIcon className="size-3 shrink-0" aria-hidden />
                  {formatTokenScale(cacheRead)}
                </span>
              ) : null}
              {cacheRead > 0 && cacheWrite > 0 ? (
                <span className="text-muted-foreground">·</span>
              ) : null}
              {cacheWrite > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                  <HardDriveUploadIcon className="size-3 shrink-0" aria-hidden />
                  {formatTokenScale(cacheWrite)}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-56">
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="text-sm font-medium">Token 明细</div>
          <div className="flex flex-col gap-1">
            {lines.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="tabular-nums">{formatInt(l.value)}</span>
              </div>
            ))}
            <div className="mt-0.5 flex items-baseline justify-between gap-4 border-t border-dashed pt-1 font-medium">
              <span>输入合计（含缓存）</span>
              <span className="tabular-nums">{formatInt(inputTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 font-medium">
              <span>输出合计</span>
              <span className="tabular-nums">{formatInt(output)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 font-medium">
              <span>全部合计</span>
              <span className="tabular-nums">{formatInt(total)}</span>
            </div>
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

/** 耗时：主行总耗时 + 次行 Gateway 首字/TPS；悬浮显示明细 + 口径说明。总耗时不按阈值着色（长输出本身就会很长）。 */
export function RequestTimingCell({ row }: { row: RequestListItem }) {
  const th = useMetricThresholds();
  if (row.latency_ms == null && row.gateway_ttft_ms == null && row.tps == null) return <Dash />;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex flex-col gap-1 py-0.5 text-left text-xs tabular-nums">
          {row.latency_ms != null ? (
            <span className="font-medium">{formatLatencyMs(row.latency_ms)}</span>
          ) : (
            <Dash />
          )}
          {(row.gateway_ttft_ms != null || row.tps != null) && (
            <span className="text-muted-foreground text-[10px]">
              {row.gateway_ttft_ms != null && (
                <span className={ttftClass(row.gateway_ttft_ms, th)}>
                  Gateway 首字 {formatLatencyMs(row.gateway_ttft_ms)}
                </span>
              )}
              {row.gateway_ttft_ms != null && row.tps != null ? " · " : ""}
              {row.tps != null && formatTPS(row.tps)}
            </span>
          )}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-64">
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="text-sm font-medium">耗时明细</div>
          <div className="flex flex-col gap-1">
            <Field label="总耗时" value={row.latency_ms != null ? formatLatencyMs(row.latency_ms) : "—"} />
            <Field
              label="Gateway TTFT"
              value={row.gateway_ttft_ms != null ? formatLatencyMs(row.gateway_ttft_ms) : "—"}
            />
            <Field label="生成速率" value={row.tps != null ? formatTPS(row.tps) : "—"} />
            <Field label="输出 tokens" value={formatInt(row.output_tokens)} />
          </div>
          <p className="text-muted-foreground/80 text-[10px] leading-relaxed">
            总耗时 = 完成 − 开始；Gateway TTFT = gateway_first_token_at − started_at；速率 = 输出 tokens ÷（完成 − Gateway 首字）。
          </p>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

/** 费用：用户扣费（悬浮显示费用明细：平台成本 / 用户价格 / 汇总，含计算过程）。 */
export function RequestCostCell({ row }: { row: RequestListItem }) {
  if (row.user_charge_usd == null) return <Dash />;

  return (
    <HoverCard openDelay={120} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex max-w-full cursor-default items-center justify-end gap-1 py-0.5"
        >
          <span
            className={cn(
              "font-medium tabular-nums underline decoration-dotted underline-offset-2",
              row.long_context_applied
                ? "text-emerald-600 decoration-emerald-600/30 dark:text-emerald-400 dark:decoration-emerald-400/30"
                : "decoration-muted-foreground/40",
            )}
          >
            {formatUSDPrecise(row.user_charge_usd)}
          </span>
          {row.long_context_applied ? <LongContextBadge /> : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="end" className="w-[22rem]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>费用明细</span>
            {row.long_context_applied ? <LongContextBadge /> : null}
          </div>
          <RequestCostBreakdown
            data={{
              tokens: {
                uncachedInput: row.uncached_input_tokens,
                cacheRead: row.cache_read_input_tokens,
                cacheWrite5m: row.cache_write_5m_input_tokens,
                cacheWrite1h: row.cache_write_1h_input_tokens,
                cacheWrite30m: row.cache_write_30m_input_tokens,
                outputTotal: row.output_tokens,
                reasoningOutput: row.reasoning_output_tokens,
              },
              costUnit: {
                uncachedInput: row.uncached_input_cost_unit_usd,
                cacheRead: row.cache_read_input_cost_unit_usd,
                cacheWrite5m: row.cache_write_5m_input_cost_unit_usd,
                cacheWrite1h: row.cache_write_1h_input_cost_unit_usd,
                cacheWrite30m: row.cache_write_30m_input_cost_unit_usd,
                output: row.output_cost_unit_usd,
                reasoning: row.reasoning_output_cost_unit_usd,
              },
              priceUnit: {
                uncachedInput: row.uncached_input_price_unit_usd,
                cacheRead: row.cache_read_input_price_unit_usd,
                cacheWrite5m: row.cache_write_5m_input_price_unit_usd,
                cacheWrite1h: row.cache_write_1h_input_price_unit_usd,
                cacheWrite30m: row.cache_write_30m_input_price_unit_usd,
                output: row.output_price_unit_usd,
                reasoning: row.reasoning_output_price_unit_usd,
              },
              costAmount: {
                uncachedInput: row.uncached_input_cost_usd,
                cacheRead: row.cache_read_input_cost_usd,
                cacheWrite5m: row.cache_write_5m_input_cost_usd,
                cacheWrite1h: row.cache_write_1h_input_cost_usd,
                cacheWrite30m: row.cache_write_30m_input_cost_usd,
                output: row.output_cost_usd,
                reasoning: row.reasoning_output_cost_usd,
                total: row.total_cost_usd,
              },
              userCharge: row.user_charge_usd,
              routeRatio: row.route_price_ratio,
              channelCostMultiplier: row.channel_cost_multiplier,
              rechargeFactor: row.recharge_factor,
              longContextApplied: row.long_context_applied,
            }}
          />
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

// 归一档位 → budget 区间文案（与后端 effortFromBudget 一致，供 Anthropic 悬浮展示）。
const EFFORT_BUDGET_RANGE: Record<string, string> = {
  none: "0",
  minimal: "1–1024",
  low: "1025–4096",
  medium: "4097–12288",
  high: "12289–24576",
  xhigh: ">24576",
};

/** 推理强度：统一档位徽标。Anthropic（有原始预算）悬浮显示 预算 + 档位区间。 */
export function RequestReasoningCell({ row }: { row: RequestListItem }) {
  const effort = row.reasoning_effort;
  if (!effort || effort === "none") return <span className="text-muted-foreground text-xs">—</span>;

  const budget = row.reasoning_budget_tokens;
  const range = EFFORT_BUDGET_RANGE[effort];
  const label = (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
      {effort}
    </Badge>
  );

  if (budget == null) return label;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default">
          {label}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-56">
        <div className="flex flex-col gap-1 text-xs">
          <div className="text-sm font-medium">思考预算</div>
          <Field label="预算" value={`${budget.toLocaleString()} tokens`} />
          <Field label="归一档位" value={`${effort}${range ? ` · 区间 ${range}` : ""}`} />
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

/** 线路：线路名 + 命中渠道副标题 + 经过渠道数徽章（悬浮显示 策略 / 倍率 / 经过渠道 / 命中渠道）。 */
export function RequestRouteCell({ row }: { row: RequestListItem }) {
  const route = row.route_name;
  const chain = row.channel_chain || "";
  const channelCount = chain
    ? chain.split(" → ").filter(Boolean).length
    : row.final_channel_name || row.final_channel_id != null
      ? 1
      : 0;

  if (!route && !chain && !row.final_channel_name && row.final_channel_id == null) {
    return <Dash />;
  }

  const modeLabel = row.route_mode ? ROUTE_MODE_LABEL[row.route_mode] ?? row.route_mode : null;
  const ratio = row.route_price_ratio;
  const chainDisplay = chain || row.final_channel_name || "";
  const hitChannelLabel =
    row.final_channel_name || row.final_channel_id != null
      ? [
          row.final_channel_name,
          row.final_channel_id != null ? `#${row.final_channel_id}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 max-w-full cursor-default flex-col gap-0.5 py-0.5 text-left"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 truncate underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
              {route ?? "—"}
            </span>
            {channelCount > 0 ? (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 px-1 text-[10px] tabular-nums font-medium"
                title={`经过 ${channelCount} 个渠道`}
                aria-label={`经过 ${channelCount} 个渠道`}
              >
                {channelCount}
              </Badge>
            ) : null}
          </span>
          {hitChannelLabel ? (
            <span className="text-muted-foreground truncate text-[10px]">{hitChannelLabel}</span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex flex-col gap-2 text-xs">
          <div className="text-sm font-medium">{route ?? "线路"}</div>
          <div className="flex flex-col gap-1">
            {modeLabel && <Field label="策略" value={modeLabel} />}
            {ratio && <Field label="倍率" value={`× ${trimDecimal(ratio)}`} />}
            {hitChannelLabel && <Field label="命中渠道" value={hitChannelLabel} />}
            {channelCount > 0 && <Field label="经过渠道数" value={String(channelCount)} />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">经过渠道</span>
            <span className="break-words leading-relaxed">{chainDisplay || "—"}</span>
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

/** 请求 ID：截断展示 + 复制（悬浮看全文）。 */
export function RequestIdCell({ row }: { row: RequestListItem }) {
  const id = row.request_id;
  return (
    <SecretCopyCell
      value={id}
      display={id.length > 14 ? `${id.slice(0, 14)}…` : id}
      tooltipTitle="完整请求 ID"
      copyAriaLabel="复制请求 ID"
      copyMessages={{ success: "已复制请求 ID", empty: "无请求 ID" }}
    />
  );
}

/** Sticky：主标签维 A（选路结果），副标维 B（绑定变更）；tip 展开前后绑定与原因。 */
export function RequestStickyCell({ row }: { row: RequestListItem }) {
  const outcome = resolveStickyOutcome(row);
  if (outcome == null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const mutation = resolveStickyMutation(row.sticky_action);
  const outcomeLabel = stickyOutcomeLabel(outcome);
  const mutationLabel = mutation ? stickyMutationLabel(mutation) : null;

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex max-w-full cursor-default flex-col items-start gap-0.5 text-left"
        >
          <span className="text-xs font-medium underline decoration-dotted underline-offset-2">
            {outcomeLabel}
          </span>
          {mutationLabel ? (
            <span className="text-muted-foreground text-[10px]">{mutationLabel}</span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex w-full flex-col gap-3">
          <div>
            <div className="text-sm font-semibold leading-tight">粘性</div>
            <div className="text-muted-foreground mt-0.5 text-[11px]">
              选路结果 · 绑定变更
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{outcomeLabel}</Badge>
            {mutationLabel ? <Badge variant="secondary">{mutationLabel}</Badge> : null}
          </div>
          <div className="space-y-1.5 text-xs">
            <Field
              label="请求前绑定"
              value={channelBindingLabel(
                row.sticky_before_channel_id,
                row.sticky_before_channel_name,
              )}
            />
            <Field
              label="请求后绑定"
              value={channelBindingLabel(
                row.sticky_after_channel_id,
                row.sticky_after_channel_name,
              )}
            />
            <Field
              label="动作原因"
              value={row.sticky_reason?.trim() || "—"}
            />
            {row.sticky_action ? (
              <Field label="原始动作" value={row.sticky_action} mono />
            ) : null}
          </div>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}
