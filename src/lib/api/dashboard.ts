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
  /** 测到延迟（成功且 completed_at 非空）的请求数 */
  sample: number;
  /** sample / 成功请求，反映平均/分位的代表性 */
  coverage: number;
}

export interface TtftStats {
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  /** 测到首 token（response_started_at 非空）的请求数 */
  sample: number;
  /** sample / 区间总请求，反映平均/分位的代表性 */
  coverage: number;
  has_data: boolean;
}

export interface CacheStats {
  read_rate: number;
  write_rate: number;
  input_tokens: number;
  uncached_tokens: number;
  cache_read_tokens: number;
  cache_write_5m_tokens: number;
  cache_write_1h_tokens: number;
  cache_write_30m_tokens: number;
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

export type BreakdownDimension = "provider" | "channel" | "model" | "route";

export interface BreakdownRow {
  label: string;
  ref_id: number | null;
  status: string;
  terminal: number;
  succeeded: number;
  failed: number;
  success_rate: number;
  tokens: number;
  /** 区间内该分组平台收入合计（USD 十进制字符串） */
  revenue_usd: string;
  /** 区间内该分组上游成本合计（USD 十进制字符串） */
  cost_usd: string;
  /** 贡献利润 = 收入 − 成本（USD 十进制字符串） */
  margin_usd: string;
  /** 区间内该分组 P95 完成延迟（毫秒）；route/model 维度仍用此字段 */
  latency_p95: number;
  /** provider/channel 维度：成功请求的加权平均输出速度 */
  avg_tps: number;
  /** provider/channel 维度：完整延迟画像 */
  latency?: LatencyStats;
  health_bucket: HealthBucket;
  recent_error: string;
  /** 服务商维度：命中渠道数 */
  channel_count: number;
  /** 渠道维度：最近 10 分钟 attempt 成功率桶 */
  success_buckets?: SuccessBucket[];
}

export interface SuccessBucket {
  bucket: string;
  terminal: number;
  succeeded: number;
  success_rate: number;
}

export interface BreakdownResult {
  dimension: BreakdownDimension;
  rows: BreakdownRow[];
}

export interface ErrorGroup {
  code: string;
  total: number;
  /** total / 区间内失败总数，[0,1] 比例 */
  share: number;
}

export interface TopErrorsResult {
  errors: ErrorGroup[];
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

export async function getTopErrors(
  params: RangeQuery,
): Promise<TopErrorsResult> {
  const res = await api.get<{ data: TopErrorsResult }>(
    "/admin/v1/dashboard/errors",
    { params },
  );
  return res.data.data;
}
