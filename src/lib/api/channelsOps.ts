import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { HealthBucket, LatencyStats, RangeQuery, SuccessBucket } from "@/lib/api/dashboard";

// §3.3 渠道作战台只读运维聚合（与后端 channels_ops DTO 对齐）。

export interface ChannelHealthCounts {
  healthy: number;
  degraded: number;
  unhealthy: number;
  no_data: number;
}

export interface ChannelsOpsSummary {
  total: number;
  enabled: number;
  disabled: number;
  health: ChannelHealthCounts;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  tps: number;
  recent_error_code: string;
  recent_error_channel: string;
  recent_error_at: string | null;
  price_total: number;
  price_with_price: number;
  price_with_cost: number;
}

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
  recent_error_code: string;
  // 渠道级限流（P2-8）：null=继承全局默认，0=不限，>0=具体上限（每分钟请求/每分钟 token/每日请求）。
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_latency_ms: number | null;
  last_test_error: string | null;
}

export interface ChannelOpsDetail {
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  last_success_at: string | null;
  last_failure_at: string | null;
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
  mode: string;
  pool_kind: string;
  status: string;
}

export interface ChannelsOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  provider_id?: number;
  search?: string;
}

export async function getChannelsOpsSummary(
  params: RangeQuery,
): Promise<ChannelsOpsSummary> {
  const res = await api.get<{ data: ChannelsOpsSummary }>(
    "/admin/v1/channels/ops/summary",
    { params },
  );
  return res.data.data;
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

export async function getChannelOpsSuccessBuckets(
  id: number,
  params: RangeQuery,
): Promise<SuccessBucket[]> {
  const res = await api.get<{ data: SuccessBucket[] }>(
    `/admin/v1/channels/${id}/ops/success-buckets`,
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
