import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";
import type { HealthBucket, LatencyStats, RangeQuery } from "@/lib/api/dashboard";

// §3.2 服务商聚合视图只读运维聚合（与后端 providers_ops DTO 对齐）。

export interface ProviderOpsRow {
  id: number;
  slug: string;
  name: string;
  status: string;
  channel_total: number;
  channel_enabled: number;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  health: HealthBucket;
  last_success_at: string | null;
}

export interface ProviderOpsDetail {
  channel_total: number;
  channel_enabled: number;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
}

export interface ProviderOpsChannel {
  id: number;
  name: string;
  base_url: string;
  status: string;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  latency: LatencyStats;
  health: HealthBucket;
}

export interface ProviderOpsPerfPoint {
  bucket: string;
  attempt_total: number;
  attempt_succeeded: number;
  latency_avg: number;
}

export interface ProviderOpsError {
  at: string;
  channel_name: string;
  upstream_model: string;
  error_code: string;
  upstream_status_code: number | null;
  request_id: string;
}

export interface ProvidersOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  status?: string;
  search?: string;
}

export async function getProvidersOpsTable(
  params: ProvidersOpsTableParams,
): Promise<Page<ProviderOpsRow>> {
  const res = await api.get<{ data: ProviderOpsRow[]; meta: ListMeta }>(
    "/admin/v1/providers/ops",
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getProviderOpsDetail(
  id: number,
  params: RangeQuery,
): Promise<ProviderOpsDetail> {
  const res = await api.get<{ data: ProviderOpsDetail }>(
    `/admin/v1/providers/${id}/ops/detail`,
    { params },
  );
  return res.data.data;
}

export async function getProviderOpsChannels(
  id: number,
  params: RangeQuery,
): Promise<ProviderOpsChannel[]> {
  const res = await api.get<{ data: ProviderOpsChannel[] }>(
    `/admin/v1/providers/${id}/ops/channels`,
    { params },
  );
  return res.data.data;
}

export async function getProviderOpsPerformance(
  id: number,
  params: RangeQuery,
): Promise<ProviderOpsPerfPoint[]> {
  const res = await api.get<{ data: ProviderOpsPerfPoint[] }>(
    `/admin/v1/providers/${id}/ops/performance`,
    { params },
  );
  return res.data.data;
}

export async function getProviderOpsErrors(
  id: number,
  params: RangeQuery & { page: number; page_size: number },
): Promise<Page<ProviderOpsError>> {
  const res = await api.get<{ data: ProviderOpsError[]; meta: ListMeta }>(
    `/admin/v1/providers/${id}/ops/errors`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}
