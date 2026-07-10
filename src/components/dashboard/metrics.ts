import type {
  CacheStats,
  RadarReport,
  RadarRequests,
} from "@/lib/api/dashboard";
import type { MetricIntent } from "@/components/common/MetricCard";

// 概览雷达卡片的纯计算 / 阈值逻辑。与组件分离，避免 fast-refresh 失效（仅组件文件应导出组件）。
//
// 告警阈值已迁移为运行时配置 admin_frontend.dashboard_thresholds（后台「运行时配置」可改，
// 免部署生效）：组件经 useMetricThresholds() 拉取当前值后显式传入本文件的纯函数。
// DEFAULT_METRIC_THRESHOLDS 是拉取失败/加载中的回退值，与后端注册表默认**同源同值**
// （unio-api appsettings/admin_frontend_settings.go），改默认须两处同步。

/** 仪表盘告警灯阈值（毫秒字段与后端 *_ms 命名对应）。 */
export interface MetricThresholds {
  successRateSlo: number;
  successRateWarn: number;
  ttftWarnMs: number;
  ttftDangerMs: number;
  latencyWarnMs: number;
  latencyDangerMs: number;
  profitThinRate: number;
}

export const DEFAULT_METRIC_THRESHOLDS: MetricThresholds = {
  successRateSlo: 0.95,
  successRateWarn: 0.8,
  ttftWarnMs: 5000,
  ttftDangerMs: 12000,
  latencyWarnMs: 15000,
  latencyDangerMs: 30000,
  profitThinRate: 0.1,
};

// ---- 请求成功率 ----

export function rateIntent(
  rate: number,
  th: MetricThresholds,
): "success" | "warning" | "danger" {
  if (rate >= th.successRateSlo) return "success";
  if (rate >= th.successRateWarn) return "warning";
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
  return c.cache_read_tokens + c.cache_write_5m_tokens + c.cache_write_1h_tokens + c.cache_write_30m_tokens;
}

// ---- 首 token 时间（TTFT，P95 口径） ----

// 健康时保持中性（仅在降级/异常时着色），避免常驻绿色噪声。
export function ttftIntent(p95: number, th: MetricThresholds): MetricIntent {
  if (p95 <= 0) return "default";
  if (p95 > th.ttftDangerMs) return "danger";
  if (p95 >= th.ttftWarnMs) return "warning";
  return "default";
}

// ---- 请求完成延迟（P95 口径） ----

export function latencyIntent(p95: number, th: MetricThresholds): MetricIntent {
  if (p95 <= 0) return "default";
  if (p95 > th.latencyDangerMs) return "danger";
  if (p95 >= th.latencyWarnMs) return "warning";
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

// 着色口径：亏损→danger；正毛利但毛利率 < profit_thin_rate 阈值→warning（避免极小正毛利
// 也显示为健康的绿色）；健康→success；打平→default。缺 revenue 时退回按符号（正→success）。
export function profitIntent(
  margin: number,
  th: MetricThresholds,
  revenue?: number,
): MetricIntent {
  if (margin < 0) return "danger";
  if (margin === 0) return "default";
  if (revenue != null && revenue > 0 && margin / revenue < th.profitThinRate) {
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
