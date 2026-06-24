import { api } from "@/lib/api/client";
import type { ListMeta, ListParams, Page } from "@/lib/api/types";

// 与后端 channelDTO 对齐；不含 credential（凭据只写不回）。
// provider_name 仅分页列表场景由后端 JOIN 带出。
export interface Channel {
  id: number;
  provider_id: number;
  provider_name: string;
  name: string;
  protocol: string;
  adapter_key: string;
  base_url: string;
  status: string;
  priority: number;
  timeout_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelListParams extends ListParams {
  providerId?: number;
}

// 服务端分页：过滤/翻页都下沉到后端 SQL，前端只拿当前页 + 总数。
export async function listChannels(
  params: ChannelListParams,
): Promise<Page<Channel>> {
  const res = await api.get<{ data: Channel[]; meta: ListMeta }>(
    "/admin/v1/channels",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        status: params.status,
        q: params.q || undefined,
        provider_id: params.providerId,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// 读取单条渠道完整配置（抽屉/编辑前回填）。
export async function getChannel(id: number): Promise<Channel> {
  const res = await api.get<{ data: Channel }>(`/admin/v1/channels/${id}`);
  return res.data.data;
}

// 创建入参与后端 createChannelRequest 对齐；credential 为明文，后端加密落库。
export interface CreateChannelInput {
  provider_id: number;
  name: string;
  protocol: string;
  adapter_key: string;
  base_url: string;
  credential: string;
  status: string;
  priority: number;
  timeout_ms: number | null;
}

export async function createChannel(
  input: CreateChannelInput,
): Promise<Channel> {
  const res = await api.post<{ data: Channel }>("/admin/v1/channels", input);
  return res.data.data;
}

// 与后端 adapterKeyOptionDTO 对齐：某协议族下一个可选 adapter_key 的枚举项。
// is_default=true 表示与协议同名的忠实透传 adapter（创建时留空即默认取它）。
export interface AdapterKeyOption {
  protocol: string;
  adapter_key: string;
  is_default: boolean;
}

// 拉取当前进程注册的全部可选 adapter_key，供新建渠道时按协议下拉而非手填。
export async function listAdapterKeys(): Promise<AdapterKeyOption[]> {
  const res = await api.get<{ data: AdapterKeyOption[] }>(
    "/admin/v1/channels/adapter-keys",
  );
  return res.data.data;
}

// 编辑只能改这几项：protocol、adapter_key、凭据都不在此修改（凭据走轮换接口）。
export interface UpdateChannelInput {
  id: number;
  name: string;
  base_url: string;
  status: string;
  priority: number;
  timeout_ms: number | null;
}

export async function updateChannel({
  id,
  ...body
}: UpdateChannelInput): Promise<Channel> {
  const res = await api.patch<{ data: Channel }>(
    `/admin/v1/channels/${id}`,
    body,
  );
  return res.data.data;
}

// 轮换凭据：只写不回，成功返回 204 无响应体。
export interface RotateCredentialInput {
  id: number;
  credential: string;
}

export async function rotateChannelCredential({
  id,
  credential,
}: RotateCredentialInput): Promise<void> {
  await api.put(`/admin/v1/channels/${id}/credential`, { credential });
}

