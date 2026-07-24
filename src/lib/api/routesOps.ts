import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { RangeQuery } from "@/lib/api/dashboard";
import type { RouteMode } from "@/lib/api/routes";
import type {
  BreakerState,
  BreakerStoreAdmission,
  RuntimeSyncState,
} from "@/lib/api/runtime";

// §3.5 线路路由作战台只读运维聚合（与后端 routes_ops DTO 对齐）。

export interface RouteOpsRow {
  id: number;
  name: string;
  mode: RouteMode;
  status: string;
  description: string;
  price_ratio: string;
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
  created_at: string;
  bound_keys: number;
  pool_channels: number;
  models_count: number;
}

export interface RouteOpsDetail {
  request_total: number;
  request_succeeded: number;
  success_rate: number;
  fallback_total: number;
  fallback_rate: number;
  no_channel_total: number;
  latency_p50: number;
  latency_p95: number;
  serviceable: boolean;
  abnormal: boolean;
  route_status: string;
}

export interface RouteOpsReachableModel {
  model_id: string;
  display_name: string;
}

export interface RouteOpsChannelPoolItem {
  channel_id: number;
  channel_name: string;
  channel_status: string;
  priority: number;
  provider_name: string;
}

interface RouteOpsBoundUser {
  id: number;
  email: string;
  display_name: string;
}

export interface RouteOpsBoundKey {
  id: number;
  name: string;
  user_id: number;
  status: string;
}

export interface RouteOpsBindings {
  users: RouteOpsBoundUser[];
  keys: RouteOpsBoundKey[];
}

export interface RouteOpsPerfPoint {
  bucket: string;
  request_total: number;
  request_succeeded: number;
  latency_p95: number;
}

export interface RouteOpsModel {
  model_id: string;
  request_total: number;
  request_succeeded: number;
  success_rate: number;
}

export interface RouteOpsRequest {
  request_id: string;
  at: string;
  status: string;
  model_id: string;
  final_channel_id: number | null;
  latency_ms: number | null;
}

export interface RouteRuntimeSource {
  name: string;
  available: boolean;
  observed_at: string | null;
  stale: boolean;
}

export interface RouteRuntimeChannel {
  channel_id: number;
  channel_name: string;
  channel_status: string;
  provider_id: number;
  provider_name: string;
  provider_status: string;
  provider_origin_id: number;
  provider_origin_name: string;
  provider_origin_status: string;
  origin_base_url_revision: number;
  origin_status_revision: number;
  runtime_origin_base_url_revision: number;
  runtime_origin_status_revision: number;
  pending_origin_base_url_revision: number | null;
  pending_origin_status_revision: number | null;
  origin_base_url_revision_current: boolean;
  origin_status_revision_current: boolean;
  origin_state_generation: number;
  origin_base_url_fence_generation: number;
  origin_status_fence_generation: number;
  channel_config_revision: number;
  runtime_channel_config_revision: number | null;
  channel_config_revision_current: boolean;
  channel_admission_limits_revision: number;
  runtime_channel_admission_limits_revision: number;
  channel_admission_limits_revision_current: boolean;
  route_rate_limits_revision: number;
  channel_rate_limits_revision: number;
  global_concurrency_revision: number;
  circuit_breaker_revision: number;
  routing_balance_revision: number;
  runtime_control_state: RuntimeSyncState;
  runtime_revision_current: boolean;
  protocol: string;
  adapter_key: string;
  priority: number;
  eligible: boolean;
  excluded_reason?: string;
  concurrency_used: number;
  concurrency_limit: number;
  concurrency_remaining: number | null;
  rpm_used: number;
  rpm_limit: number;
  rpm_remaining: number | null;
  rpd_used: number;
  rpd_limit: number;
  rpd_remaining: number | null;
  tpm_used: number;
  tpm_limit: number;
  tpm_remaining: number | null;
  capacity_score: number;
  cost_ratio?: number | null;
  cost_weight?: number;
  cost_factor?: number;
  final_weight: number;
  pressure: number;
  capacity_unknown: boolean;
  capacity_read_failed: boolean;
  origin_breaker_state: BreakerState | null;
  origin_open_remaining_ms: number | null;
  channel_breaker_state: BreakerState | null;
  channel_open_remaining_ms: number | null;
  error_rate: number | null;
  error_samples: number;
  ttft_ewma_ms: number | null;
  ttft_samples: number;
  ttft_sample_source: "stream_only";
  cooldown_remaining_ms: number;
  model_permission_paused: boolean;
  model_permission_recheck_state: string;
  runtime_sync_state: RuntimeSyncState;
  breaker_store_admission: BreakerStoreAdmission;
  current_order: number;
  selected_1m: number;
  selected_5m: number;
  selected_share_1m: number;
  selected_share_5m: number;
  fallback_1m: number;
  margin_status: string;
}

export interface RouteRuntime {
  route_id: number;
  mode: RouteMode;
  route_status: string;
  model_id?: string;
  protocol?: string;
  observed_at: string;
  stale: boolean;
  pool_size: number;
  candidate_count: number;
  no_redundancy: boolean;
  all_capacity_zero: boolean;
  runtime_sync_state: RuntimeSyncState;
  breaker_store_admission: BreakerStoreAdmission;
  sources: RouteRuntimeSource[];
  channels: RouteRuntimeChannel[];
}

export interface RoutingCandidateScore {
  origin_id: number;
  channel_id: number;
  route_index: number;
  eligible: boolean;
  excluded_reason?: string;
  candidate_origin_base_url_revision: number;
  runtime_origin_base_url_revision: number;
  origin_base_url_revision_current: boolean;
  candidate_origin_status_revision: number;
  runtime_origin_status_revision: number;
  origin_status_revision_current: boolean;
  candidate_channel_config_revision: number;
  runtime_channel_config_revision: number | null;
  channel_config_revision_current: boolean;
  candidate_channel_admission_limits_revision: number;
  runtime_channel_admission_limits_revision: number;
  channel_admission_limits_revision_current: boolean;
  route_rate_limits_revision: number;
  channel_rate_limits_revision: number;
  global_concurrency_revision: number;
  circuit_breaker_revision: number;
  routing_balance_revision: number;
  runtime_control_state: RuntimeSyncState;
  runtime_revision_current: boolean;
  origin_breaker_state?: BreakerState;
  channel_breaker_state?: BreakerState;
  breaker_store_admission: BreakerStoreAdmission;
  concurrency_remaining: number | null;
  tpm_remaining: number | null;
  capacity_score: number;
  error_rate: number;
  error_samples: number;
  ttft_ewma_ms: number;
  ttft_samples: number;
  ttft_sample_source: "stream_only";
  latency_penalty: number;
  routing_factor: number;
  cost_ratio?: number | null;
  cost_weight?: number;
  cost_factor?: number;
  final_weight: number;
  pressure: number;
  capacity_unknown: boolean;
  capacity_read_failed: boolean;
  cooldown_remaining_ms: number;
  model_permission_paused: boolean;
  model_permission_recheck_state: string;
}

export interface RoutingDecision {
  id: number;
  request_record_id: number;
  request_id: string;
  request_status: string;
  route_id: number;
  mode: RouteMode;
  requested_model_id: string;
  protocol: string;
  endpoint: string;
  pool_size: number;
  candidate_count: number;
  sticky_channel_id: number | null;
  sticky_pinned: boolean;
  sticky_invalid: boolean;
  all_capacity_zero: boolean;
  margin_guard_triggered: boolean;
  abnormal: boolean;
  abnormal_reasons: string[];
  candidate_scores: RoutingCandidateScore[];
  selected_order: number[];
  fallback_chain: unknown[];
  final_channel_id: number | null;
  algorithm_version: string;
  sampled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutesOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  search?: string;
}

export async function getRoutesOpsTable(
  params: RoutesOpsTableParams,
): Promise<Page<RouteOpsRow>> {
  const res = await api.get<{ data: RouteOpsRow[]; meta: ListMeta }>(
    "/admin/v1/routes/ops",
    {
      params: buildListQuery(params),
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getRouteOpsDetail(
  id: number,
  params: RangeQuery,
): Promise<RouteOpsDetail> {
  const res = await api.get<{ data: RouteOpsDetail }>(
    `/admin/v1/routes/${id}/ops/detail`,
    { params },
  );
  return res.data.data;
}

export async function getRouteOpsReachableModels(
  id: number,
): Promise<RouteOpsReachableModel[]> {
  const res = await api.get<{ data: RouteOpsReachableModel[] }>(
    `/admin/v1/routes/${id}/ops/reachable-models`,
  );
  return res.data.data;
}

export async function getRouteOpsChannelPool(
  id: number,
): Promise<RouteOpsChannelPoolItem[]> {
  const res = await api.get<{ data: RouteOpsChannelPoolItem[] }>(
    `/admin/v1/routes/${id}/ops/channel-pool`,
  );
  return res.data.data;
}

export async function getRouteOpsBindings(
  id: number,
): Promise<RouteOpsBindings> {
  const res = await api.get<{ data: RouteOpsBindings }>(
    `/admin/v1/routes/${id}/ops/bindings`,
  );
  return res.data.data;
}

export async function getRouteOpsPerformance(
  id: number,
  params: RangeQuery,
): Promise<RouteOpsPerfPoint[]> {
  const res = await api.get<{ data: RouteOpsPerfPoint[] }>(
    `/admin/v1/routes/${id}/ops/performance`,
    { params },
  );
  return res.data.data;
}

export async function getRouteOpsModels(
  id: number,
  params: RangeQuery,
): Promise<RouteOpsModel[]> {
  const res = await api.get<{ data: RouteOpsModel[] }>(
    `/admin/v1/routes/${id}/ops/models`,
    { params },
  );
  return res.data.data;
}

export async function getRouteOpsRequests(
  id: number,
  params: RangeQuery & { page: number; page_size: number },
): Promise<Page<RouteOpsRequest>> {
  const res = await api.get<{ data: RouteOpsRequest[]; meta: ListMeta }>(
    `/admin/v1/routes/${id}/ops/requests`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getRouteRuntime(
  id: number,
  params: { model_id: string; protocol?: "openai" | "anthropic" },
): Promise<RouteRuntime> {
  const res = await api.get<{ data: RouteRuntime }>(
    `/admin/v1/routes/${id}/ops/runtime`,
    { params },
  );
  return res.data.data;
}

export async function getRouteRoutingDecisions(
  id: number,
  params: { page: number; page_size: number },
): Promise<Page<RoutingDecision>> {
  const res = await api.get<{ data: RoutingDecision[]; meta: ListMeta }>(
    `/admin/v1/routes/${id}/ops/decisions`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getRequestRoutingDecision(
  requestId: string,
): Promise<RoutingDecision> {
  const res = await api.get<{ data: RoutingDecision }>(
    `/admin/v1/requests/${encodeURIComponent(requestId)}/routing-decision`,
  );
  return res.data.data;
}
