import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { LatencyStats, RangeQuery } from "@/lib/api/dashboard";

// §3.2 服务商聚合视图只读运维聚合（与后端 providers_ops DTO 对齐）。

export interface ProviderOpsRow {
  id: number;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  origins: ProviderOpsOrigin[];
  channel_total: number;
  models_count: number;
  routes_count: number;
}

export interface ProviderOpsOrigin {
  id: number;
  name: string;
  base_url: string;
  status: string;
}

export interface ProviderOpsDetail {
  channel_total: number;
  channel_enabled: number;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  timeout_total: number;
  latency: LatencyStats;
  tokens: number;
  revenue_usd: string;
  cost_usd: string;
  margin_usd: string;
  avg_tps: number;
}

export interface ProviderOpsChannelCatalogItem {
  id: number;
  name: string;
  status: string;
}

export interface ProviderOpsModelCatalogItem {
  model_id: string;
  display_name: string;
}

export interface ProviderOpsRouteCatalogItem {
  id: number;
  name: string;
  status: string;
  mode: string;
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
  sort?: string;
  status?: string;
  search?: string;
}

export async function getProvidersOpsTable(
  params: ProvidersOpsTableParams,
): Promise<Page<ProviderOpsRow>> {
  const res = await api.get<{ data: ProviderOpsRow[]; meta: ListMeta }>(
    "/admin/v1/providers/ops",
    { params: buildListQuery(params) },
  );
  return {
    items: res.data.data.map((provider) => ({
      ...provider,
      origins: provider.origins ?? [],
    })),
    total: res.data.meta.total,
  };
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

export async function getProviderOpsChannelCatalog(
  id: number,
): Promise<ProviderOpsChannelCatalogItem[]> {
  const res = await api.get<{ data: ProviderOpsChannelCatalogItem[] }>(
    `/admin/v1/providers/${id}/ops/channel-catalog`,
  );
  return res.data.data;
}

export async function getProviderOpsModelCatalog(
  id: number,
): Promise<ProviderOpsModelCatalogItem[]> {
  const res = await api.get<{ data: ProviderOpsModelCatalogItem[] }>(
    `/admin/v1/providers/${id}/ops/model-catalog`,
  );
  return res.data.data;
}

export async function getProviderOpsRouteCatalog(
  id: number,
): Promise<ProviderOpsRouteCatalogItem[]> {
  const res = await api.get<{ data: ProviderOpsRouteCatalogItem[] }>(
    `/admin/v1/providers/${id}/ops/route-catalog`,
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
