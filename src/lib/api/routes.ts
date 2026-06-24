import { api } from "@/lib/api/client";

// 与后端 routeDTO 对齐（阶段 15：线路 = 渠道商品）。
// mode: cheapest | stable | fixed；pool_kind: all（动态全量）| explicit（手挑渠道）。
// is_builtin 的内置「经济/稳定」只读不可删；channels 仅 explicit 线路有值。
export interface RouteChannel {
  channel_id: number;
  channel_name: string;
  provider_id: number;
  provider_slug: string;
}

export interface Route {
  id: number;
  name: string;
  mode: string;
  pool_kind: string;
  is_builtin: boolean;
  status: string;
  description: string | null;
  channels: RouteChannel[];
  created_at: string;
  updated_at: string;
}

export async function listRoutes(): Promise<Route[]> {
  const res = await api.get<{ data: Route[] }>(`/admin/v1/routes`);
  return res.data.data;
}

export async function getRoute(id: number): Promise<Route> {
  const res = await api.get<{ data: Route }>(`/admin/v1/routes/${id}`);
  return res.data.data;
}

export interface CreateRouteInput {
  name: string;
  mode: string;
  pool_kind: string;
  status: string;
  description: string | null;
  channel_ids: number[];
}

export async function createRoute(input: CreateRouteInput): Promise<Route> {
  const res = await api.post<{ data: Route }>(`/admin/v1/routes`, input);
  return res.data.data;
}

export interface UpdateRouteInput extends CreateRouteInput {
  id: number;
}

export async function updateRoute({
  id,
  ...body
}: UpdateRouteInput): Promise<Route> {
  const res = await api.patch<{ data: Route }>(`/admin/v1/routes/${id}`, body);
  return res.data.data;
}

export async function deleteRoute(id: number): Promise<void> {
  await api.delete(`/admin/v1/routes/${id}`);
}
