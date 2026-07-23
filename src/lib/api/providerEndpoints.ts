import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";
import type { BreakerState, RuntimeSyncState } from "@/lib/api/runtime";

export type ProviderEndpointStatus = "enabled" | "disabled" | "archived";
export type CreatableProviderEndpointStatus = Exclude<
  ProviderEndpointStatus,
  "archived"
>;

export interface ProviderEndpoint {
  id: number;
  provider_id: number;
  provider_name: string;
  name: string;
  base_url: string;
  base_url_revision: number;
  status: ProviderEndpointStatus;
  status_revision: number;
  channel_count: number;
  runtime_sync_pending: boolean;
  runtime_sync_state: RuntimeSyncState;
  runtime_active_base_url_revision: number | null;
  runtime_pending_base_url_revision: number | null;
  runtime_active_status_revision: number | null;
  runtime_pending_status_revision: number | null;
  runtime_effective_status: ProviderEndpointStatus | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderEndpointListParams {
  providerId?: number;
  status?: ProviderEndpointStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listProviderEndpoints(
  params: ProviderEndpointListParams = {},
): Promise<Page<ProviderEndpoint>> {
  const res = await api.get<{ data: ProviderEndpoint[]; meta: ListMeta }>(
    "/admin/v1/provider-endpoints",
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

export async function getProviderEndpoint(
  id: number,
): Promise<ProviderEndpoint> {
  const res = await api.get<{ data: ProviderEndpoint }>(
    `/admin/v1/provider-endpoints/${id}`,
  );
  return res.data.data;
}

export interface CreateProviderEndpointInput {
  provider_id: number;
  name: string;
  base_url: string;
  status: CreatableProviderEndpointStatus;
}

export async function createProviderEndpoint(
  input: CreateProviderEndpointInput,
): Promise<ProviderEndpoint> {
  const res = await api.post<{ data: ProviderEndpoint }>(
    "/admin/v1/provider-endpoints",
    input,
  );
  return res.data.data;
}

export async function updateProviderEndpointName(
  id: number,
  name: string,
): Promise<ProviderEndpoint> {
  const res = await api.patch<{ data: ProviderEndpoint }>(
    `/admin/v1/provider-endpoints/${id}`,
    { name },
  );
  return res.data.data;
}

export async function updateProviderEndpointBaseURL(
  id: number,
  baseURL: string,
): Promise<ProviderEndpoint> {
  const res = await api.post<{ data: ProviderEndpoint }>(
    `/admin/v1/provider-endpoints/${id}/base-url`,
    { base_url: baseURL },
  );
  return res.data.data;
}

export async function updateProviderEndpointStatus(
  id: number,
  status: ProviderEndpointStatus,
): Promise<ProviderEndpoint> {
  const res = await api.post<{ data: ProviderEndpoint }>(
    `/admin/v1/provider-endpoints/${id}/status`,
    { status },
  );
  return res.data.data;
}

export interface BreakerRuntimeSnapshot {
  scope: "endpoint" | "channel";
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
  effective_status: ProviderEndpointStatus;
}

export async function getProviderEndpointRuntime(
  id: number,
): Promise<BreakerRuntimeSnapshot> {
  const res = await api.get<{ data: BreakerRuntimeSnapshot }>(
    `/admin/v1/provider-endpoints/${id}/ops/runtime`,
  );
  return res.data.data;
}

export async function resetProviderEndpointBreaker(
  id: number,
): Promise<BreakerRuntimeSnapshot> {
  const res = await api.delete<{ data: BreakerRuntimeSnapshot }>(
    `/admin/v1/provider-endpoints/${id}/ops/circuit-breaker`,
  );
  return res.data.data;
}
