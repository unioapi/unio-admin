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
  concurrency_limit: number | null;
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

interface RouteRuntimeSource {
  name: string;
  available: boolean;
  observed_at: string | null;
  stale: boolean;
}

interface RouteRuntimeSourceStatus {
  state: RuntimeSyncState;
  breaker_store_admission: BreakerStoreAdmission;
  observed_at: string;
  stale: boolean;
  sources: RouteRuntimeSource[];
}

interface RouteUsage {
  concurrency: number;
  rpm: number;
  rpd: number;
  tpm: number;
  active_users: number;
}

interface RouteRuntimeSummary {
  route_id: number;
  mode: RouteMode;
  status: string;
  pool_size: number;
  candidate_count: number;
  no_redundancy: boolean;
  all_capacity_full: boolean;
  usage: RouteUsage | null;
}

interface RouteRuntimeFilters {
  model_id: string;
  protocol: string;
}

interface RouteRuntimeScoreConfig {
  algorithm_version: string;
  revision: number;
  cost_weight_pct: number;
  concurrency_weight_pct: number;
  ttft_weight_pct: number;
  error_rate_weight_pct: number;
  priority_weight_pct: number;
  ttft_penalty_unit_ms: number;
  ttft_penalty_points_per_unit: number;
  error_penalty_points_per_percent: number;
}

interface RouteRuntimeSampleWindow {
  ttft_window_ms: number;
  error_window_ms: number;
  started_at: string | null;
  ended_at: string | null;
  available: boolean;
}

interface RouteRuntimeProvider {
  id: number;
  name: string;
  status: string;
}

export interface RouteRuntimeEligibilityCheck {
  key: string;
  status: "passed" | "failed";
  reason?: string;
}

interface RouteRuntimeEligibility {
  status: "eligible" | "excluded" | "probe_only";
  primary_reason?: string;
  reasons: string[];
  checks: RouteRuntimeEligibilityCheck[];
}

interface RouteRuntimeState {
  state: RuntimeSyncState;
  config_synchronized: boolean;
  breaker_store_admission: BreakerStoreAdmission;
  capacity_read_failed: boolean;
}

interface RouteRuntimeConcurrency {
  used: number;
  limit: number;
  remaining: number | null;
  remaining_pct: number | null;
  unlimited: boolean;
  metric_score: number;
  contribution: number;
}

interface RouteRuntimeQualityMetric {
  has_samples: boolean;
  value: number | null;
  sample_count: number;
  metric_score: number;
  contribution: number;
}

interface RouteRuntimeQuality {
  ttft: RouteRuntimeQualityMetric;
  error_rate: RouteRuntimeQualityMetric;
}

interface RouteRuntimeTraffic {
  rpm: number;
  rpd: number;
  tpm: number;
  token_covered_attempts: number;
  token_coverage_pct: number;
}

export interface RouteRuntimeScoreComponent {
  metric_score: number;
  weight_pct: number;
  contribution: number;
}

interface RouteRuntimeScore {
  algorithm_version: string;
  total: number;
  cost_ratio: number | null;
  priority: number;
  cost: RouteRuntimeScoreComponent;
  concurrency: RouteRuntimeScoreComponent;
  ttft: RouteRuntimeScoreComponent;
  error_rate: RouteRuntimeScoreComponent;
  priority_score: RouteRuntimeScoreComponent;
}

interface RouteRuntimeDistribution {
  selected_1m: number;
  selected_5m: number;
  selected_share_1m: number;
  selected_share_5m: number;
  fallback_1m: number;
}

interface RouteRuntimeDiagnostics {
  origin_revision: number;
  runtime_origin_revision: number;
  provider_status_revision: number;
  runtime_provider_status_revision: number;
  channel_config_revision: number;
  runtime_channel_config_revision: number | null;
  channel_capacity_revision: number;
  runtime_channel_capacity_revision: number;
  global_concurrency_revision: number;
  circuit_breaker_revision: number;
  routing_balance_revision: number;
  runtime_control_state: RuntimeSyncState;
}

export interface RouteRuntimeChannel {
  channel_id: number;
  channel_name: string;
  channel_status: string;
  provider: RouteRuntimeProvider;
  protocol: string;
  adapter_key: string;
  priority: number;
  order: number;
  eligibility: RouteRuntimeEligibility;
  runtime: RouteRuntimeState;
  concurrency: RouteRuntimeConcurrency;
  quality: RouteRuntimeQuality;
  traffic: RouteRuntimeTraffic;
  score: RouteRuntimeScore;
  distribution: RouteRuntimeDistribution;
  internal_diagnostics: RouteRuntimeDiagnostics;
}

export interface RouteRuntime {
  source_status: RouteRuntimeSourceStatus;
  route_summary: RouteRuntimeSummary;
  filters: RouteRuntimeFilters;
  channels: RouteRuntimeChannel[];
  score_config: RouteRuntimeScoreConfig;
  sample_window: RouteRuntimeSampleWindow;
}

export interface RoutingCandidateScore {
  provider_id: number;
  channel_id: number;
  route_index: number;
  eligible: boolean;
  excluded_reason?: string;
  candidate_origin_revision: number;
  runtime_origin_revision: number;
  origin_revision_current: boolean;
  candidate_provider_status_revision: number;
  runtime_provider_status_revision: number;
  provider_status_revision_current: boolean;
  candidate_channel_config_revision: number;
  runtime_channel_config_revision: number | null;
  channel_config_revision_current: boolean;
  candidate_channel_capacity_revision: number;
  runtime_channel_capacity_revision: number;
  channel_capacity_revision_current: boolean;
  route_rate_limits_revision: number;
  global_concurrency_revision: number;
  circuit_breaker_revision: number;
  routing_balance_revision: number;
  // Historical trace candidates can be excluded before runtime facts are read.
  runtime_control_state: RuntimeSyncState | "";
  runtime_revision_current: boolean;
  provider_breaker_state?: BreakerState;
  channel_breaker_state?: BreakerState;
  breaker_store_admission: BreakerStoreAdmission | "";
  concurrency_remaining: number | null;
  algorithm_version: string;
  cost_score: number;
  concurrency_score: number;
  ttft_score: number;
  error_score: number;
  priority_score: number;
  final_score: number;
  cost_weight_pct: number;
  concurrency_weight_pct: number;
  ttft_weight_pct: number;
  error_rate_weight_pct: number;
  priority_weight_pct: number;
  cost_ratio: number;
  priority: number;
  /** 上游 TTFT 算术均值（ms）；来自评分样本窗口，不是 Gateway TTFT。 */
  avg_ttft_ms: number;
  ttft_sample_count: number;
  error_rate_pct: number;
  error_sample_count: number;
  capacity_unknown: boolean;
  capacity_read_failed: boolean;
  cooldown_remaining_ms: number;
  model_permission_paused: boolean;
  model_permission_recheck_state: string;
}

interface RoutingAcquireResult {
  pass: number;
  channel_id: number;
  admitted: boolean;
  reason?: string;
}

interface RoutingTransportAttempt {
  channel_id: number;
  upstream_endpoint: string;
}

interface RoutingStickyTrace {
  key_present: boolean;
  before_channel_id?: number;
  before_version?: number;
  action?: string;
  reason?: string;
  after_channel_id?: number;
  after_version?: number;
  pinned: boolean;
  pinned_non_preferred: boolean;
}

interface RoutingCapacityWaitTrace {
  result?: string;
  waited_ms?: number;
  entered: boolean;
}

interface RoutingTraceProcess {
  schema_version: number;
  algorithm_version: string;
  mode: RouteMode;
  candidates: RoutingCandidateScore[];
  baseline_order: number[];
  actual_scan_order: number[];
  acquire_results: RoutingAcquireResult[];
  attempts: RoutingTransportAttempt[];
  attempted_channel_ids: number[];
  sticky: RoutingStickyTrace;
  capacity_wait: RoutingCapacityWaitTrace;
  score_config: {
    routing_balance_revision: number;
    cost_weight_pct: number;
    concurrency_weight_pct: number;
    ttft_weight_pct: number;
    error_rate_weight_pct: number;
    priority_weight_pct: number;
  };
  abnormal_reasons: string[];
  final_result?: string;
}

interface RoutingDecisionSummary {
  pool_size: number;
  eligible_count: number;
  baseline_order: number[];
  actual_scan_order: number[];
  attempted_channel_ids: number[];
  selected_channel_id: number | null;
  final_channel_id: number | null;
  fallback_count: number;
  final_result: string | null;
  sticky_key_present: boolean;
  sticky_before_channel_id: number | null;
  sticky_before_version: number | null;
  sticky_action: string | null;
  sticky_reason: string | null;
  sticky_after_channel_id: number | null;
  sticky_after_version: number | null;
  capacity_wait_ms: number | null;
  capacity_wait_result: string | null;
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
  trace_status: "partial" | "complete" | "legacy_sampled";
  schema_version: number;
  algorithm_version: string;
  summary: RoutingDecisionSummary;
  process: RoutingTraceProcess;
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
  params: {
    model_id: string;
    protocol?: "openai" | "anthropic";
    /** 后端排序：order / score / concurrency / ttft / error / rpm；前缀 `-` 表示降序。 */
    sort?: string;
  },
): Promise<RouteRuntime> {
  const res = await api.get<{ data: RouteRuntime }>(
    `/admin/v1/routes/${id}/ops/runtime`,
    { params },
  );
  return res.data.data;
}
