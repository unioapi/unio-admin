import { api } from "@/lib/api/client";
import type { ListMeta, ListParams, Page } from "@/lib/api/types";

export interface Provider {
  id: number;
  slug: string;
  name: string;
  origin: string;
  origin_revision: number;
  status: string;
  status_revision: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  runtime_sync_pending: boolean;
}

export interface ProviderStatusChangeResult {
  runtime_sync_pending: boolean;
}

// 服务端分页：把 page/page_size/status/q 作为 query 传给后端，拆出 items + total。
// 空的 status/q 由 axios 自动从 query 省略（值为 undefined 不发送）。
// 仅供本文件 listAllProviders 复用（下拉用），不直接对外导出。
async function listProviders(params: ListParams): Promise<Page<Provider>> {
  const res = await api.get<{ data: Provider[]; meta: ListMeta }>(
    "/admin/v1/providers",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        status: params.status,
        q: params.q || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// 给「创建渠道」的服务商下拉用：服务商数量天然很少，一次拉满（上限 100）即可，
// 不需要在选择框里做分页。
export async function listAllProviders(): Promise<Provider[]> {
  const { items } = await listProviders({ page: 1, pageSize: 100 });
  return items;
}

export interface CreateProviderInput {
  slug: string;
  name: string;
  origin: string;
  status: string;
}

// 创建成功返回 201 + { data: Provider }；同样在这层拆信封。
export async function createProvider(
  input: CreateProviderInput,
): Promise<Provider> {
  const res = await api.post<{ data: Provider }>("/admin/v1/providers", input);
  return res.data.data;
}

// slug、origin 与 status 均不走普通编辑；origin/status 各自使用独立 revision CAS。
export interface UpdateProviderInput {
  id: number;
  name: string;
}

export async function updateProvider({
  id,
  ...body
}: UpdateProviderInput): Promise<Provider> {
  const res = await api.patch<{ data: Provider }>(
    `/admin/v1/providers/${id}`,
    body,
  );
  return res.data.data;
}

export interface UpdateProviderOriginInput {
  id: number;
  origin: string;
  expected_origin_revision: number;
  confirm_enabled_channels?: boolean;
}

export async function updateProviderOrigin({
  id,
  ...body
}: UpdateProviderOriginInput): Promise<Provider> {
  const res = await api.patch<{ data: Provider }>(
    `/admin/v1/providers/${id}/origin`,
    body,
  );
  return res.data.data;
}

export interface UpdateProviderStatusInput {
  id: number;
  status: string;
  expected_status_revision: number;
}

export async function updateProviderStatus({
  id,
  ...body
}: UpdateProviderStatusInput): Promise<Provider> {
  const res = await api.post<{ data: Provider }>(
    `/admin/v1/providers/${id}/status`,
    body,
  );
  return res.data.data;
}

// 删除服务商：仅允许删除已归档的服务商（后端「先归档才能删」闸门）；后端会连带清理其名下上游源站
//（及其操作日志审计置空）。名下仍有渠道、或其（含源站）已被请求/账务历史引用时，后端返回 409。
export async function deleteProvider(id: number): Promise<void> {
  await api.delete(`/admin/v1/providers/${id}`);
}

export async function archiveProvider(id: number): Promise<ProviderStatusChangeResult> {
  const res = await api.post<{ data: ProviderStatusChangeResult }>(
    `/admin/v1/providers/${id}/archive`,
    {},
  );
  return res.data.data;
}

// 恢复服务商：archived → disabled（名下渠道不自动恢复，需逐个恢复）。
export async function restoreProvider(id: number): Promise<ProviderStatusChangeResult> {
  const res = await api.post<{ data: ProviderStatusChangeResult }>(
    `/admin/v1/providers/${id}/restore`,
  );
  return res.data.data;
}

export interface ProviderRuntime {
  id: number;
  origin_revision: number;
  status_revision: number;
  effective_status: string;
  origin_revision_state: string;
  status_revision_state: string;
  pending_origin_revision: number;
  pending_status_revision: number;
  state: string;
  state_generation: number;
  runtime_sync_state: string;
}

export async function getProviderRuntime(
  id: number,
  signal?: AbortSignal,
): Promise<ProviderRuntime> {
  const path = `/admin/v1/providers/${id}/ops/runtime`;
  const res = signal
    ? await api.get<{ data: ProviderRuntime }>(path, { signal })
    : await api.get<{ data: ProviderRuntime }>(path);
  return res.data.data;
}

export async function resetProviderBreaker(id: number): Promise<ProviderRuntime> {
  const res = await api.delete<{ data: ProviderRuntime }>(
    `/admin/v1/providers/${id}/ops/circuit-breaker`,
  );
  return res.data.data;
}
