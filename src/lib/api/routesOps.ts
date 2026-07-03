import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { RangeQuery } from "@/lib/api/dashboard";

// §3.5 线路路由作战台只读运维聚合（与后端 routes_ops DTO 对齐）。

export interface RoutesOpsSummary {
  total: number;
  enabled: number;
  disabled: number;
  request_total: number;
  succeeded: number;
  success_rate: number;
  fallback_total: number;
  fallback_rate: number;
  no_channel: number;
  latency_p95: number;
}

export interface RouteOpsRow {
  id: number;
  name: string;
  mode: string;
  pool_kind: string;
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

export interface RouteOpsBoundUser {
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

export interface RoutesOpsTableParams extends RangeQuery {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  search?: string;
}

export async function getRoutesOpsSummary(params: RangeQuery): Promise<RoutesOpsSummary> {
  const res = await api.get<{ data: RoutesOpsSummary }>("/admin/v1/routes/ops/summary", { params });
  return res.data.data;
}

export async function getRoutesOpsTable(params: RoutesOpsTableParams): Promise<Page<RouteOpsRow>> {
  const res = await api.get<{ data: RouteOpsRow[]; meta: ListMeta }>("/admin/v1/routes/ops", {
    params: buildListQuery(params),
  });
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getRouteOpsDetail(id: number, params: RangeQuery): Promise<RouteOpsDetail> {
  const res = await api.get<{ data: RouteOpsDetail }>(`/admin/v1/routes/${id}/ops/detail`, { params });
  return res.data.data;
}

export async function getRouteOpsReachableModels(id: number): Promise<RouteOpsReachableModel[]> {
  const res = await api.get<{ data: RouteOpsReachableModel[] }>(
    `/admin/v1/routes/${id}/ops/reachable-models`,
  );
  return res.data.data;
}

export async function getRouteOpsChannelPool(id: number): Promise<RouteOpsChannelPoolItem[]> {
  const res = await api.get<{ data: RouteOpsChannelPoolItem[] }>(`/admin/v1/routes/${id}/ops/channel-pool`);
  return res.data.data;
}

export async function getRouteOpsBindings(id: number): Promise<RouteOpsBindings> {
  const res = await api.get<{ data: RouteOpsBindings }>(`/admin/v1/routes/${id}/ops/bindings`);
  return res.data.data;
}

export async function getRouteOpsPerformance(id: number, params: RangeQuery): Promise<RouteOpsPerfPoint[]> {
  const res = await api.get<{ data: RouteOpsPerfPoint[] }>(`/admin/v1/routes/${id}/ops/performance`, { params });
  return res.data.data;
}

export async function getRouteOpsModels(id: number, params: RangeQuery): Promise<RouteOpsModel[]> {
  const res = await api.get<{ data: RouteOpsModel[] }>(`/admin/v1/routes/${id}/ops/models`, { params });
  return res.data.data;
}

export async function getRouteOpsRequests(
  id: number,
  params: RangeQuery & { page: number; page_size: number },
): Promise<Page<RouteOpsRequest>> {
  const res = await api.get<{ data: RouteOpsRequest[]; meta: ListMeta }>(`/admin/v1/routes/${id}/ops/requests`, { params });
  return { items: res.data.data, total: res.data.meta.total };
}
