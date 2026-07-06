import { api } from "@/lib/api/client";
import type { ListMeta, ListParams, Page } from "@/lib/api/types";

// 与后端 channelDTO 对齐；含 credential（产品决策：渠道凭据明文存储，可查看/复制/编辑）。
// provider_name 列表与单条读取均由后端补全；编辑表单仍会用 providers 列表兜底。
export interface Channel {
  id: number;
  provider_id: number;
  provider_name: string;
  name: string;
  protocol: string;
  adapter_key: string;
  base_url: string;
  // 明文上游 API key（产品决策：明文存储，管理端可查看/复制/编辑）。
  credential: string;
  status: string;
  priority: number;
  timeout_ms: number | null;
  // 渠道级限流（P2-8）：null=继承全局默认，0=不限，>0=具体上限（每分钟请求/每分钟 token/每日请求）。
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpd_limit: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // 最近一次主动检测结果（渠道检测，阶段一）：全 null 表示从未检测。
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_latency_ms: number | null;
  last_test_error: string | null;
}

// 限流三维入参（P2-8）：null=继承全局默认，0=不限，>0=具体上限。
export interface RateLimitsInput {
  rpm: number | null;
  tpm: number | null;
  rpd: number | null;
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
  // 可选渠道级限流；省略表示三维全继承全局默认。
  rateLimits?: RateLimitsInput;
}

export async function createChannel({
  rateLimits,
  ...input
}: CreateChannelInput): Promise<Channel> {
  const res = await api.post<{ data: Channel }>("/admin/v1/channels", {
    ...input,
    rate_limits: rateLimits ?? undefined,
  });
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
  // 渠道级限流；省略表示不变，传对象即原子替换三维。
  rateLimits?: RateLimitsInput;
}

export async function updateChannel({
  id,
  rateLimits,
  ...body
}: UpdateChannelInput): Promise<Channel> {
  const res = await api.patch<{ data: Channel }>(`/admin/v1/channels/${id}`, {
    ...body,
    rate_limits: rateLimits ?? undefined,
  });
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

// 删除渠道：仅允许删除已归档且无历史引用的渠道（后端「先归档才能删」闸门）。
export async function deleteChannel(id: number): Promise<void> {
  await api.delete(`/admin/v1/channels/${id}`);
}

// 归档渠道：从所有线路池移除、置 archived、释放渠道名（追加 __archived_<id> 后缀）；可恢复。
export async function archiveChannel(id: number): Promise<void> {
  await api.post(`/admin/v1/channels/${id}/archive`);
}

// 恢复渠道：archived → disabled（护栏：所属服务商归档时后端拦截，需先恢复服务商）。
export async function restoreChannel(id: number): Promise<void> {
  await api.post(`/admin/v1/channels/${id}/restore`);
}

// 与后端 channelTestResultDTO 对齐：一次渠道检测结果。
// 始终代表「检测已执行」（HTTP 200）；success 表达渠道是否健康，error_code 成功时为 null。
export interface ChannelTestResult {
  success: boolean;
  latency_ms: number;
  tested_model: string;
  http_status: number;
  error_code: string | null;
  message: string;
  // 失败时上游返回的原始错误体（截断快照）；成功/无响应体时为 null。
  upstream_error: string | null;
  tested_at: string;
}

// 触发一次渠道主动检测：用渠道自己的 base_url + 凭据挑一个绑定模型向真实上游发一个最小请求，
// 验证「连得上 + 凭据有效 + 模型可用」。model 省略时后端自动取第一个启用绑定模型；stream 阶段一忽略。
export async function testChannel(
  id: number,
  params?: { model?: string; stream?: boolean },
): Promise<ChannelTestResult> {
  const res = await api.post<{ data: ChannelTestResult }>(
    `/admin/v1/channels/${id}/test`,
    { model: params?.model ?? "", stream: params?.stream ?? false },
  );
  return res.data.data;
}

