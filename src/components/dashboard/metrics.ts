import type {
  CacheStats,
  RadarReport,
  RadarRequests,
} from "@/lib/api/dashboard";
import type { MetricIntent } from "@/components/common/MetricCard";

// 概览雷达卡片的纯计算 / 阈值逻辑。与组件分离，避免 fast-refresh 失效（仅组件文件应导出组件）。

// ---- 请求成功率 ----
// SLO 参考线（success 阈值）与 warning 阈值；rateIntent 与参考线统一引用，避免魔法数散落。
export const SUCCESS_RATE_SLO = 0.95;
export const SUCCESS_RATE_WARN = 0.8;

export function rateIntent(rate: number): "success" | "warning" | "danger" {
  if (rate >= SUCCESS_RATE_SLO) return "success";
  if (rate >= SUCCESS_RATE_WARN) return "warning";
  return "danger";
}

// 「完成」= 成功 + 失败（成功率分母口径）；canceled 客户端取消不计入。
export function requestTerminal(req: RadarRequests): number {
  return req.succeeded + req.failed;
}

// 进行中 = pending / running（总请求 − 完成 − 取消）。
export function requestInFlight(req: RadarRequests): number {
  return Math.max(0, req.total - req.succeeded - req.failed - req.canceled);
}

// ---- 缓存 ----

export function cacheWeightTokens(c: CacheStats): number {
  return c.cache_read_tokens + c.cache_write_5m_tokens + c.cache_write_1h_tokens;
}

// ---- 首 token 时间（TTFT） ----
// 健康阈值（P95，与平台状态 §3.1 一致）：> 12s 异常，≥ 5s 注意。
export const TTFT_WARN_MS = 5000;
export const TTFT_DANGER_MS = 12000;

// 健康时保持中性（仅在降级/异常时着色），避免常驻绿色噪声。
export function ttftIntent(p95: number): MetricIntent {
  if (p95 <= 0) return "default";
  if (p95 > TTFT_DANGER_MS) return "danger";
  if (p95 >= TTFT_WARN_MS) return "warning";
  return "default";
}

// ---- 请求完成延迟 ----
// 健康阈值（P95，与平台状态 §3.1 一致）：> 30s 异常，≥ 15s 注意。
export const LATENCY_WARN_MS = 15000;
export const LATENCY_DANGER_MS = 30000;

export function latencyIntent(p95: number): MetricIntent {
  if (p95 <= 0) return "default";
  if (p95 > LATENCY_DANGER_MS) return "danger";
  if (p95 >= LATENCY_WARN_MS) return "warning";
  return "default";
}

// ---- 营收 ----

export type Revenue = Pick<
  RadarReport,
  "revenue_usd" | "cost_usd" | "margin_usd"
>;

export function profitRate(r: Revenue): number {
  const rev = Number(r.revenue_usd);
  if (!rev || rev <= 0) return 0;
  return Number(r.margin_usd) / rev;
}

// 毛利率低于此阈值视为「偏薄」，着 warning（避免极小正毛利也显示为健康的绿色）。
export const PROFIT_THIN_RATE = 0.1;

// 着色口径：亏损→danger；正毛利但毛利率 < 阈值→warning；健康→success；打平→default。
// 缺 revenue 时退回按符号（正→success）。
export function profitIntent(margin: number, revenue?: number): MetricIntent {
  if (margin < 0) return "danger";
  if (margin === 0) return "default";
  if (revenue != null && revenue > 0 && margin / revenue < PROFIT_THIN_RATE) {
    return "warning";
  }
  return "success";
}

// ---- 结算异常 ----

export type Settlement = Pick<
  RadarReport,
  "billing_exceptions" | "settlement_backlog"
>;

// 异常数量 = 计费异常事件数 + 结算补偿失败(dead)。补偿中(active)为自动重试，不计入。
export function settlementAnomalyCount(s: Settlement): number {
  return s.billing_exceptions.total + s.settlement_backlog.dead;
}

export function settlementIntent(s: Settlement): MetricIntent {
  if (s.settlement_backlog.dead > 0) return "danger";
  if (s.billing_exceptions.total > 0) return "warning";
  return "default";
}
