import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { RangeQuery } from "@/lib/api/dashboard";

// §3.4 模型商品控制台只读运维聚合（与后端 models_ops DTO 对齐）。

export interface ModelsOpsSummary {
  total: number;
  enabled: number;
  disabled: number;
  sellable: number;
  no_channel: number;
  price_total: number;
  price_with_price: number;
  request_total: number;
  succeeded: number;
  success_rate: number;
  revenue_usd: string;
  cost_usd: string;
  margin_usd: string;
  margin_rate: number;
}

export interface ModelOpsRow {
  id: number;
  model_id: string;
  display_name: string;
  owned_by: string;
  status: string;
  created_at: string;
  max_output_tokens: number | null;
  context_window_tokens: number | null;
  bindings_total: number;
  bindings_available: number;
  capabilities_declared_count: number;
  has_price: boolean;
  sellable: boolean;
  // 基准售价（DEC-026 model_prices，每 1M tokens）；无基准价时为 null。
  base_currency: string | null;
  base_uncached_input_price: string | null;
  base_cache_read_input_price: string | null;
  base_cache_write_5m_input_price: string | null;
  base_cache_write_1h_input_price: string | null;
  base_cache_write_30m_input_price: string | null;
  base_output_price: string | null;
  base_reasoning_output_price: string | null;
}

export interface ModelOpsDetail {
  request_total: number;
  request_succeeded: number;
  success_rate: number;
  latency_avg: number;
  latency_p50: number;
  latency_p95: number;
  output_tokens: number;
  input_tokens: number;
  cache_read_rate: number;
  tps: number;
  revenue_usd: string;
  margin_usd: string;
  margin_rate: number;
  sellable: boolean;
  bindings_total: number;
  bindings_available: number;
  model_status: string;
}

export interface ModelOpsChannel {
  channel_id: number;
  channel_name: string;
  channel_status: string;
  binding_status: string;
  upstream_model: string;
  priority: number;
  attempt_total: number;
  attempt_succeeded: number;
  success_rate: number;
  latency_p95: number;
  has_price: boolean;
  input_cost: string | null;
  output_cost: string | null;
}

export interface ModelOpsPerfPoint {
  bucket: string;
  request_total: number;
  request_succeeded: number;
  latency_p95: number;
}

export interface ModelOpsRequest {
  request_id: string;
  at: string;
  status: string;
  error_code: string;
  final_channel_id: number | null;
  latency_ms: number | null;
}

export interface ModelsOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  search?: string;
}

export async function getModelsOpsSummary(
  params: RangeQuery,
): Promise<ModelsOpsSummary> {
  const res = await api.get<{ data: ModelsOpsSummary }>(
    "/admin/v1/models/ops/summary",
    { params },
  );
  return res.data.data;
}

export async function getModelsOpsTable(
  params: ModelsOpsTableParams,
): Promise<Page<ModelOpsRow>> {
  const res = await api.get<{ data: ModelOpsRow[]; meta: ListMeta }>(
    "/admin/v1/models/ops",
    { params: buildListQuery(params) },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getModelOpsDetail(
  id: number,
  params: RangeQuery,
): Promise<ModelOpsDetail> {
  const res = await api.get<{ data: ModelOpsDetail }>(
    `/admin/v1/models/${id}/ops/detail`,
    { params },
  );
  return res.data.data;
}

export async function getModelOpsChannels(
  id: number,
  params: RangeQuery,
): Promise<ModelOpsChannel[]> {
  const res = await api.get<{ data: ModelOpsChannel[] }>(
    `/admin/v1/models/${id}/ops/channels`,
    { params },
  );
  return res.data.data;
}

export async function getModelOpsPerformance(
  id: number,
  params: RangeQuery,
): Promise<ModelOpsPerfPoint[]> {
  const res = await api.get<{ data: ModelOpsPerfPoint[] }>(
    `/admin/v1/models/${id}/ops/performance`,
    { params },
  );
  return res.data.data;
}

export async function getModelOpsRequests(
  id: number,
  params: RangeQuery & { page: number; page_size: number },
): Promise<Page<ModelOpsRequest>> {
  const res = await api.get<{ data: ModelOpsRequest[]; meta: ListMeta }>(
    `/admin/v1/models/${id}/ops/requests`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}
