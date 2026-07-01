import { api } from "@/lib/api/client";

// 与后端 routeDTO 对齐（阶段 15：线路 = 渠道商品）。
// mode: cheapest | stable | fixed；pool_kind: all（动态全量）| explicit（手挑渠道）。
// channels 仅 explicit 线路有值。
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
  status: string;
  // price_ratio 客户售价倍率（DEC-026：客户售价 = 模型基准价 × 倍率），十进制字符串。
  price_ratio: string;
  // 线路级限流（DEC-027：按 (线路,用户) 计数）：null=继承全局默认，0=不限，>0=具体上限。
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
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
  price_ratio: string; // 客户售价倍率（十进制字符串，空=默认 1.0）
  // 线路级限流（DEC-027）：null=继承全局默认，0=不限，>0=具体上限。
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
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
