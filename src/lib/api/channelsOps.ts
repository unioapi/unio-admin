import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { HealthBucket, LatencyStats, RangeQuery } from "@/lib/api/dashboard";
import type { RouteMode } from "@/lib/api/routes";

// §3.3 渠道作战台只读运维聚合（与后端 channels_ops DTO 对齐）。

export interface ChannelOpsRow {
  id: number;
  name: string;
  status: string;
  created_at: string;
  protocol: string;
  adapter_key: string;
  base_url: string;
  priority: number;
  timeout_ms: number | null;
  provider_name: string;
  credential: string;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  health: HealthBucket;
  bound_models: number;
  bound_routes: number;
  recent_error_code: string;
  // 渠道级限流（P2-8）：null=继承全局默认，0=不限，>0=具体上限（每分钟请求/每分钟 token/每日请求）。
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_latency_ms: number | null;
  last_test_error: string | null;
  // 阶段二凭据闸门：false=系统判定凭据失效（连续 401 或检测判定），即使 status=enabled 也不参与路由。
  credential_valid: boolean;
  // 当前生效的渠道默认价格倍率；null=未配置。
  cost_multiplier: string | null;
  // 当前生效的逐模型价格倍率覆盖条数。
  cost_multiplier_overrides: number;
  // 当前生效的充值倍率；null=未配置（结算按 1.0）。
  recharge_factor: string | null;
  // gateway 进程内熔断快照；缺省时前端按闭合（绿）常驻显示。
  circuit_breaker?: ChannelCircuitBreakerStatus | null;
}

export interface ChannelCircuitBreakerStatus {
  state: "open" | "half_open" | "closed" | string;
  failures: number;
  successes: number;
  window_start?: string | null;
  opened_at?: string | null;
  open_remaining_ms?: number | null;
  half_open_in_flight: boolean;
  health_score: number;
  observed_at: string;
  instances?: ChannelCircuitBreakerInstance[];
}

export interface ChannelCircuitBreakerInstance {
  id: string;
  state: string;
  open_remaining_ms?: number | null;
  half_open_in_flight: boolean;
  failures: number;
  successes: number;
}

export interface ChannelTestLog {
  id: number;
  created_at: string;
  source: string; // worker / manual / runtime_401
  success: boolean;
  error_code: string | null;
  http_status: number | null;
  latency_ms: number;
  tested_model: string;
  credential_valid_after: boolean;
  message: string;
  // 失败时上游返回的原始错误体（截断快照）；成功/无响应体时为 null。
  upstream_error: string | null;
}

export interface ChannelOpsDetail {
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  last_success_at: string | null;
  last_failure_at: string | null;
  /** gateway 熔断快照；缺省时前端按闭合显示。 */
  circuit_breaker?: ChannelCircuitBreakerStatus | null;
}

export interface ChannelOpsPerfPoint {
  bucket: string;
  attempt_total: number;
  attempt_succeeded: number;
  latency_avg: number;
}

export interface ChannelOpsError {
  at: string;
  upstream_model: string;
  error_code: string;
  upstream_status_code: number | null;
  error_message: string;
  request_id: string;
}

export interface ChannelOpsModel {
  model_id: number;
  model_ref: string;
  display_name: string;
  upstream_model: string;
  status: string;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  latency: LatencyStats;
  has_price: boolean;
}

export interface ChannelOpsRoute {
  id: number;
  name: string;
  mode: RouteMode;
  status: string;
  price_ratio: string;
}

export interface ChannelsOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  provider_id?: number;
  search?: string;
}

export async function getChannelsOpsTable(
  params: ChannelsOpsTableParams,
): Promise<Page<ChannelOpsRow>> {
  const res = await api.get<{ data: ChannelOpsRow[]; meta: ListMeta }>(
    "/admin/v1/channels/ops",
    { params: buildListQuery(params) },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getChannelOpsDetail(
  id: number,
  params: RangeQuery,
): Promise<ChannelOpsDetail> {
  const res = await api.get<{ data: ChannelOpsDetail }>(
    `/admin/v1/channels/${id}/ops/detail`,
    { params },
  );
  return res.data.data;
}

export async function getChannelOpsPerformance(
  id: number,
  params: RangeQuery,
): Promise<ChannelOpsPerfPoint[]> {
  const res = await api.get<{ data: ChannelOpsPerfPoint[] }>(
    `/admin/v1/channels/${id}/ops/performance`,
    { params },
  );
  return res.data.data;
}

export async function getChannelOpsErrors(
  id: number,
  params: RangeQuery & { page: number; page_size: number },
): Promise<Page<ChannelOpsError>> {
  const res = await api.get<{ data: ChannelOpsError[]; meta: ListMeta }>(
    `/admin/v1/channels/${id}/ops/errors`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getChannelOpsModels(
  id: number,
  params: RangeQuery,
): Promise<ChannelOpsModel[]> {
  const res = await api.get<{ data: ChannelOpsModel[] }>(
    `/admin/v1/channels/${id}/ops/models`,
    { params },
  );
  return res.data.data;
}

export async function getChannelOpsRoutes(
  id: number,
): Promise<ChannelOpsRoute[]> {
  const res = await api.get<{ data: ChannelOpsRoute[] }>(
    `/admin/v1/channels/${id}/ops/routes`,
  );
  return res.data.data;
}

export async function getChannelTestLogs(
  id: number,
  params: { page: number; page_size: number },
): Promise<Page<ChannelTestLog>> {
  const res = await api.get<{ data: ChannelTestLog[]; meta: ListMeta }>(
    `/admin/v1/channels/${id}/test-logs`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}
