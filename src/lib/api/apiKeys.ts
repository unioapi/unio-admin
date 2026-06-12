import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";

// 与后端 apiKeyDTO 对齐；绝不含 key_hash。
// status: active / disabled / revoked / expired（后端按优先级计算）。
// spend_limit 为 null 表示不限额；spent_total 是迄今累计被扣金额。
export interface ApiKey {
  id: number;
  project_id: number;
  name: string;
  key_prefix: string;
  status: string;
  spend_limit: string | null;
  spent_total: string;
  last_used_at: string | null;
  expires_at: string | null;
  disabled_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

// 创建结果：含只展示一次的明文 plaintext。
export interface CreatedApiKey extends ApiKey {
  plaintext: string;
}

export async function listApiKeys(
  projectId: number,
  page: number,
  pageSize: number,
): Promise<Page<ApiKey>> {
  const res = await api.get<{ data: ApiKey[]; meta: ListMeta }>(
    `/admin/v1/projects/${projectId}/api-keys`,
    { params: { page, page_size: pageSize } },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export interface CreateApiKeyInput {
  projectId: number;
  name: string;
  // RFC3339，可选过期时间。
  expiresAt?: string | null;
  // 费用上限（十进制字符串），不传/空串表示不限额。
  spendLimit?: string;
}

export async function createApiKey(
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  const res = await api.post<{ data: CreatedApiKey }>(
    `/admin/v1/projects/${input.projectId}/api-keys`,
    {
      name: input.name,
      expires_at: input.expiresAt || undefined,
      spend_limit: input.spendLimit ?? undefined,
    },
  );
  return res.data.data;
}

// 更新：disabled 启停；spend_limit 设上限（""=清除上限/改为不限额，省略=不变）。
export interface UpdateApiKeyInput {
  id: number;
  disabled?: boolean;
  spendLimit?: string;
}

export async function updateApiKey(input: UpdateApiKeyInput): Promise<ApiKey> {
  const body: Record<string, unknown> = {};
  if (input.disabled !== undefined) body.disabled = input.disabled;
  if (input.spendLimit !== undefined) body.spend_limit = input.spendLimit;
  const res = await api.patch<{ data: ApiKey }>(
    `/admin/v1/api-keys/${input.id}`,
    body,
  );
  return res.data.data;
}

// 永久吊销（不可逆）。
export async function revokeApiKey(id: number): Promise<ApiKey> {
  const res = await api.delete<{ data: ApiKey }>(`/admin/v1/api-keys/${id}`);
  return res.data.data;
}
