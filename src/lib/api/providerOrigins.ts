import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";
import type { BreakerState, RuntimeSyncState } from "@/lib/api/runtime";

export type ProviderOriginStatus = "enabled" | "disabled" | "archived";
export type CreatableProviderOriginStatus = Exclude<
  ProviderOriginStatus,
  "archived"
>;

export interface ProviderOrigin {
  id: number;
  provider_id: number;
  provider_name: string;
  name: string;
  base_url: string;
  base_url_revision: number;
  status: ProviderOriginStatus;
  status_revision: number;
  channel_count: number;
  runtime_sync_pending: boolean;
  runtime_sync_state: RuntimeSyncState;
  runtime_active_base_url_revision: number | null;
  runtime_pending_base_url_revision: number | null;
  runtime_active_status_revision: number | null;
  runtime_pending_status_revision: number | null;
  runtime_effective_status: ProviderOriginStatus | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderOriginListParams {
  providerId?: number;
  status?: ProviderOriginStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listProviderOrigins(
  params: ProviderOriginListParams = {},
): Promise<Page<ProviderOrigin>> {
  const res = await api.get<{ data: ProviderOrigin[]; meta: ListMeta }>(
    "/admin/v1/provider-origins",
    {
      params: {
        provider_id: params.providerId,
        status: params.status,
        q: params.q || undefined,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 100,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getProviderOrigin(
  id: number,
): Promise<ProviderOrigin> {
  const res = await api.get<{ data: ProviderOrigin }>(
    `/admin/v1/provider-origins/${id}`,
  );
  return res.data.data;
}

export interface CreateProviderOriginInput {
  provider_id: number;
  name: string;
  base_url: string;
  status: CreatableProviderOriginStatus;
}

export async function createProviderOrigin(
  input: CreateProviderOriginInput,
): Promise<ProviderOrigin> {
  const res = await api.post<{ data: ProviderOrigin }>(
    "/admin/v1/provider-origins",
    input,
  );
  return res.data.data;
}

export async function updateProviderOriginName(
  id: number,
  name: string,
): Promise<ProviderOrigin> {
  const res = await api.patch<{ data: ProviderOrigin }>(
    `/admin/v1/provider-origins/${id}`,
    { name },
  );
  return res.data.data;
}

export async function updateProviderOriginBaseURL(
  id: number,
  baseURL: string,
): Promise<ProviderOrigin> {
  const res = await api.post<{ data: ProviderOrigin }>(
    `/admin/v1/provider-origins/${id}/base-url`,
    { base_url: baseURL },
  );
  return res.data.data;
}

export async function updateProviderOriginStatus(
  id: number,
  status: ProviderOriginStatus,
): Promise<ProviderOrigin> {
  const res = await api.post<{ data: ProviderOrigin }>(
    `/admin/v1/provider-origins/${id}/status`,
    { status },
  );
  return res.data.data;
}

export interface BreakerRuntimeSnapshot {
  scope: "origin" | "channel";
  id: number;
  exists: boolean;
  state: BreakerState;
  open_remaining_ms: number;
  open_level: number;
  eligible_successes: number;
  eligible_failures: number;
  consecutive_failures: number;
  error_rate: number;
  sample_count: number;
  ttft_ewma_ms: number;
  ttft_samples: number;
  ttft_sample_source: "stream_only";
  active_base_url_revision: number;
  pending_base_url_revision: number;
  active_status_revision: number;
  pending_status_revision: number;
  effective_status: ProviderOriginStatus;
}

export async function getProviderOriginRuntime(
  id: number,
): Promise<BreakerRuntimeSnapshot> {
  const res = await api.get<{ data: BreakerRuntimeSnapshot }>(
    `/admin/v1/provider-origins/${id}/ops/runtime`,
  );
  return res.data.data;
}

export async function resetProviderOriginBreaker(
  id: number,
): Promise<BreakerRuntimeSnapshot> {
  const res = await api.delete<{ data: BreakerRuntimeSnapshot }>(
    `/admin/v1/provider-origins/${id}/ops/circuit-breaker`,
  );
  return res.data.data;
}
