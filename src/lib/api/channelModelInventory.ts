import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";
import type { CatalogCapabilityHint } from "@/lib/api/modelCatalog";

export type InventoryRunStatus = "queued" | "running" | "succeeded" | "failed" | "stale";

export interface ChannelModelInventoryRun {
  id: number;
  channel_id: number;
  source: "manual" | "setup" | "scheduled";
  status: InventoryRunStatus;
  channel_config_revision: number;
  provider_origin_revision: number;
  provider_status_revision: number;
  attempt_count: number;
  total_count: number;
  succeeded_count: number;
  failed_count: number;
  warning_code: string | null;
  error_code: string | null;
  message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface InventoryVerification {
  item_id: number;
  run_id: number;
  status: string;
  current: boolean;
  http_status: number;
  error_code: string | null;
  message: string | null;
  latency_ms: number | null;
  completed_at: string | null;
}

export interface InventoryModelCandidate {
  id: number;
  model_id: string;
  display_name: string;
  status: string;
  canonical_id: string;
}

export interface InventoryCatalogCandidate {
  canonical_id: string;
  lab: string;
  display_name: string;
  removed_upstream: boolean;
  adopted_models: InventoryModelCandidate[];
}

export interface ChannelModelInventoryBinding {
  id: number;
  model_id: number;
  model_external_id: string;
  model_display_name: string;
  model_status: string;
  upstream_model: string;
  status: string;
  adopted_canonical_id: string;
  verification: InventoryVerification | null;
}

export interface ChannelModelInventoryItem {
  upstream_model: string;
  owned_by: string;
  upstream_created_at: string | null;
  discovery_state: "discovered" | "not_seen";
  bindings: ChannelModelInventoryBinding[];
  match: {
    kind: "bound" | "local_model" | "adopted_model" | "catalog" | "ambiguous_catalog" | "none";
    exact_model: InventoryModelCandidate | null;
    catalog_candidates: InventoryCatalogCandidate[];
  };
}

export interface ChannelModelInventory {
  channel: {
    id: number;
    name: string;
    status: string;
    protocol: string;
    adapter_key: string;
    provider_id: number;
    provider_slug: string;
  };
  latest_discovery: ChannelModelInventoryRun | null;
  snapshot: ChannelModelInventoryRun | null;
  snapshot_stale: boolean;
  stats: {
    discovered: number;
    bindings: number;
    new: number;
    pending: number;
  };
  items: ChannelModelInventoryItem[];
}

export interface VerificationItem {
  id: number;
  run_id: number;
  model_id: number;
  upstream_model: string;
  status: string;
  success: boolean | null;
  http_status: number;
  error_code: string | null;
  message: string | null;
  latency_ms: number | null;
  provider_probe_record_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface VerificationResult {
  run: ChannelModelInventoryRun;
  items: VerificationItem[];
}

export interface BindingResult {
  id: number;
  channel_id: number;
  model_id: number;
  model_external_id: string;
  model_display_name: string;
  upstream_model: string;
  status: string;
}

export async function getChannelModelInventory(channelId: number): Promise<ChannelModelInventory> {
  const res = await api.get<{ data: ChannelModelInventory }>(
    `/admin/v1/channels/${channelId}/model-inventory`,
  );
  return res.data.data;
}

export async function createChannelModelDiscovery(
  channelId: number,
  source: "manual" | "setup" = "manual",
): Promise<ChannelModelInventoryRun> {
  const res = await api.post<{ data: ChannelModelInventoryRun }>(
    `/admin/v1/channels/${channelId}/model-discoveries`,
    { source },
  );
  return res.data.data;
}

export async function getChannelModelDiscovery(
  channelId: number,
  runId: number,
): Promise<ChannelModelInventoryRun> {
  const res = await api.get<{ data: ChannelModelInventoryRun }>(
    `/admin/v1/channels/${channelId}/model-discoveries/${runId}`,
  );
  return res.data.data;
}

export async function listChannelModelDiscoveries(
  channelId: number,
  page = 1,
  pageSize = 20,
): Promise<Page<ChannelModelInventoryRun>> {
  const res = await api.get<{ data: ChannelModelInventoryRun[]; meta: ListMeta }>(
    `/admin/v1/channels/${channelId}/model-discoveries`,
    { params: { page, page_size: pageSize } },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export interface VerificationTarget {
  model_id: number;
  upstream_model?: string;
}

export async function createChannelModelVerification(
  channelId: number,
  targets: VerificationTarget[],
  source: "manual" | "setup" = "manual",
): Promise<VerificationResult> {
  const res = await api.post<{ data: VerificationResult }>(
    `/admin/v1/channels/${channelId}/model-verifications`,
    { source, targets },
  );
  return res.data.data;
}

export async function getChannelModelVerification(
  channelId: number,
  runId: number,
): Promise<VerificationResult> {
  const res = await api.get<{ data: VerificationResult }>(
    `/admin/v1/channels/${channelId}/model-verifications/${runId}`,
  );
  return res.data.data;
}

export async function bindChannelModels(
  channelId: number,
  bindings: Array<{ model_id: number; upstream_model: string }>,
): Promise<BindingResult[]> {
  const res = await api.post<{ data: BindingResult[] }>(
    `/admin/v1/channels/${channelId}/models/batch`,
    { bindings },
  );
  return res.data.data;
}

export interface AdoptAndBindInput {
  canonical_id: string;
  model_id: string;
  display_name: string;
  owned_by: string;
  upstream_model: string;
  max_output_tokens?: number | null;
  context_window_tokens?: number | null;
  input_price_usd_per_million_tokens?: string | null;
  output_price_usd_per_million_tokens?: string | null;
  release_date?: string | null;
  capabilities: CatalogCapabilityHint[];
}

export async function adoptAndBindChannelModel(
  channelId: number,
  input: AdoptAndBindInput,
): Promise<BindingResult> {
  const res = await api.post<{ data: BindingResult }>(
    `/admin/v1/channels/${channelId}/models/adopt-and-bind`,
    input,
  );
  return res.data.data;
}

export function isTerminalRun(status: InventoryRunStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "stale";
}
