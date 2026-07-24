import { api } from "@/lib/api/client";
import type { ListMeta, ListParams, Page } from "@/lib/api/types";

export interface Provider {
  id: number;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  runtime_sync_pending: boolean;
  affected_origin_count: number;
}

export interface ProviderStatusChangeResult {
  runtime_sync_pending: boolean;
  affected_origin_count: number;
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
  status: string;
}

// 创建成功返回 201 + { data: Provider }；同样在这层拆信封。
export async function createProvider(
  input: CreateProviderInput,
): Promise<Provider> {
  const res = await api.post<{ data: Provider }>("/admin/v1/providers", input);
  return res.data.data;
}

// slug 不可变，所以 update 只收 name + status（后端要求 name 非空）。
export interface UpdateProviderInput {
  id: number;
  name: string;
  status: string;
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

// 删除服务商：仅允许删除已归档的服务商（后端「先归档才能删」闸门）；后端会连带清理其名下上游源站
//（及其操作日志审计置空）。名下仍有渠道、或其（含源站）已被请求/账务历史引用时，后端返回 409。
export async function deleteProvider(id: number): Promise<void> {
  await api.delete(`/admin/v1/providers/${id}`);
}

// 归档服务商：可在同一事务中为受影响线路加入一条外部替代渠道。
export async function archiveProvider(
  id: number,
  replacementChannelId?: number,
): Promise<ProviderStatusChangeResult> {
  const res = await api.post<{ data: ProviderStatusChangeResult }>(
    `/admin/v1/providers/${id}/archive`,
    replacementChannelId == null
      ? {}
      : { replacement_channel_id: replacementChannelId },
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
