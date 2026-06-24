import { api } from "@/lib/api/client";

// 与后端 dashboard DTO 对齐。金额一律十进制字符串（不经 float）；率为 [0,1] 比例。

export interface TokenStats {
  input: number;
  output: number;
  total: number;
}

export type HealthBucket = "healthy" | "degraded" | "unhealthy" | "no_data";

export type TimeseriesMetric = "requests" | "tokens" | "spend" | "cost";
export type TimeseriesInterval = "minute" | "hour" | "day";

export interface RequestPoint {
  bucket: string;
  total: number;
  succeeded: number;
}

export interface TokenPoint {
  bucket: string;
  input: number;
  output: number;
}

export interface SpendPoint {
  bucket: string;
  currency: string;
  amount: string;
}

// points 形状随 metric 而定；调用方按 metric 收窄类型。
export interface DashboardSeries<
  P = RequestPoint | TokenPoint | SpendPoint,
> {
  metric: TimeseriesMetric;
  interval: TimeseriesInterval;
  from: string;
  to: string;
  points: P[];
}

export async function getTimeseries<P = RequestPoint | TokenPoint | SpendPoint>(
  params: {
    metric: TimeseriesMetric;
    interval: TimeseriesInterval;
    from: string;
    to: string;
  },
): Promise<DashboardSeries<P>> {
  const res = await api.get<{ data: DashboardSeries<P> }>(
    "/admin/v1/dashboard/timeseries",
    {
      params: {
        metric: params.metric,
        interval: params.interval,
        from: params.from,
        to: params.to,
      },
    },
  );
  return res.data.data;
}

// ---- §3.1 概览重构：radar / breakdown / performance ----

// 区间查询参数（与 useRangeQuery 对齐）；range=all 时后端不限时间。
export interface RangeQuery {
  from?: string;
  to?: string;
  range?: string;
  interval?: TimeseriesInterval;
}

export type PlatformLevel =
  | "healthy"
  | "degraded"
  | "down"
  | "insufficient_data";

export interface RadarPlatformStatus {
  level: PlatformLevel;
  reason: string;
  window_from: string;
  window_to: string;
  terminal: number;
  succeeded: number;
  success_rate: number;
  no_channel: number;
  timeout: number;
}

export interface RadarRequests {
  total: number;
  succeeded: number;
  failed: number;
  canceled: number;
  success_rate: number;
  error_rate: number;
  timeout: number;
}

export interface LatencyStats {
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface TtftStats {
  p50: number;
  p95: number;
  has_data: boolean;
}

export interface CacheStats {
  read_rate: number;
  write_rate: number;
  input_tokens: number;
}

export interface RadarActionItem {
  kind: string;
  severity: "warning" | "danger";
  title: string;
  detail: string;
  deeplink: string;
}

export interface RadarBadChannel {
  channel_id: number;
  name: string;
  status: string;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  bucket: HealthBucket;
  recent_error_code: string;
}

export interface RadarReport {
  range: { from: string; to: string };
  platform_status: RadarPlatformStatus;
  requests: RadarRequests;
  latency: LatencyStats;
  ttft: TtftStats;
  tps: number;
  tokens: TokenStats;
  cache: CacheStats;
  revenue_usd: string;
  cost_usd: string;
  margin_usd: string;
  billing_exceptions: { total: number; amount: string };
  settlement_backlog: { active: number; dead: number };
  action_items: RadarActionItem[];
  bad_channels: RadarBadChannel[];
}

export type BreakdownDimension = "route" | "channel" | "model";

export interface BreakdownRow {
  label: string;
  ref_id: number | null;
  status: string;
  terminal: number;
  succeeded: number;
  success_rate: number;
}

export interface BreakdownResult {
  dimension: BreakdownDimension;
  rows: BreakdownRow[];
}

export interface PerformancePoint {
  bucket: string;
  latency_p95: number;
  ttft_p95: number;
  tps: number;
}

export interface PerformanceSeries {
  interval: TimeseriesInterval;
  from: string;
  to: string;
  points: PerformancePoint[];
}

export async function getRadar(params: RangeQuery): Promise<RadarReport> {
  const res = await api.get<{ data: RadarReport }>("/admin/v1/dashboard/radar", {
    params,
  });
  return res.data.data;
}

export async function getBreakdown(
  dimension: BreakdownDimension,
  params: RangeQuery,
): Promise<BreakdownResult> {
  const res = await api.get<{ data: BreakdownResult }>(
    "/admin/v1/dashboard/breakdown",
    { params: { ...params, dimension } },
  );
  return res.data.data;
}

export async function getPerformanceSeries(
  params: RangeQuery,
): Promise<PerformanceSeries> {
  const res = await api.get<{ data: PerformanceSeries }>(
    "/admin/v1/dashboard/timeseries/performance",
    { params },
  );
  return res.data.data;
}
