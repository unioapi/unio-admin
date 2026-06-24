import { api } from "@/lib/api/client";

// 与后端能力管理 DTO 对齐（M5）。limits 原样透传 JSON（无则为 null）。
// 能力 key 是稳定契约（docs/protocol/CAPABILITY_KEYS.md）；support_level：full/limited/unsupported。
// 阶段 14 起能力不再带 source。

export type SupportLevel = "full" | "limited" | "unsupported";

// 能力 key 协议归属（capability_keys.protocol_scope；shared=双协议通用）。
export type ProtocolScope = "shared" | "openai" | "anthropic";

export interface ModelCapability {
  model_id: number;
  capability_key: string;
  support_level: SupportLevel;
  limits: unknown | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- 能力 key 字典（DEC-024：DB 字典表为唯一真源，带中文描述供运维区分）----

export interface CapabilityKeyDef {
  key: string;
  domain: string;
  display_name: string;
  description: string;
  sort_order: number;
  deprecated: boolean;
  protocol_scope: ProtocolScope | "both";
}

export async function listCapabilityKeys(): Promise<CapabilityKeyDef[]> {
  const res = await api.get<{ data: CapabilityKeyDef[] }>(
    "/admin/v1/capability/keys",
  );
  return res.data.data;
}

export interface CreateCapabilityKeyInput {
  key: string;
  domain: string;
  display_name: string;
  description: string;
  sort_order: number;
  deprecated: boolean;
  protocol_scope: ProtocolScope;
}

export interface UpdateCapabilityKeyInput {
  domain: string;
  display_name: string;
  description: string;
  sort_order: number;
  deprecated: boolean;
  protocol_scope: ProtocolScope;
}

export async function createCapabilityKey(
  input: CreateCapabilityKeyInput,
): Promise<CapabilityKeyDef> {
  const res = await api.post<{ data: CapabilityKeyDef }>(
    "/admin/v1/capability/keys",
    input,
  );
  return res.data.data;
}

export async function updateCapabilityKey(
  key: string,
  input: UpdateCapabilityKeyInput,
): Promise<CapabilityKeyDef> {
  const res = await api.put<{ data: CapabilityKeyDef }>(
    `/admin/v1/capability/keys/${encodeURIComponent(key)}`,
    input,
  );
  return res.data.data;
}

export async function deleteCapabilityKey(key: string): Promise<void> {
  await api.delete(`/admin/v1/capability/keys/${encodeURIComponent(key)}`);
}

// ---- 模型能力（手工声明 / 展示，DEC-024 删能力闸门后仅用于 /v1/models 展示与 Admin 矩阵）----

export async function listModelCapabilities(
  modelId: number,
): Promise<ModelCapability[]> {
  const res = await api.get<{ data: ModelCapability[] }>(
    `/admin/v1/models/${modelId}/capabilities`,
  );
  return res.data.data;
}

// ---- 批量整表覆盖（一次保存多条，DEC-024 §6.2）----

export interface ModelCapabilityItem {
  capability_key: string;
  support_level: SupportLevel;
  limits?: unknown;
}

// 声明式 replace-all：提交后该模型能力 = 传入集合（未列出的删除），一事务原子写入。
export async function replaceModelCapabilities(
  modelId: number,
  capabilities: ModelCapabilityItem[],
): Promise<ModelCapability[]> {
  const res = await api.put<{ data: ModelCapability[] }>(
    `/admin/v1/models/${modelId}/capabilities`,
    { capabilities },
  );
  return res.data.data;
}

// ---- models.dev 同步 ----

export interface SyncJob {
  id: number;
  source: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  stats: unknown | null;
  error_text: string | null;
  created_at: string;
}

export interface SyncResult {
  dry_run: boolean;
  feed_models: number;
  upserted: number;
  removed: number;
  capability_hints: number;
  removed_canonical_ids: string[];
  fingerprint: string;
}

export async function listSyncJobs(limit = 20): Promise<SyncJob[]> {
  const res = await api.get<{ data: SyncJob[] }>(
    "/admin/v1/capability/sync-jobs",
    { params: { limit } },
  );
  return res.data.data;
}

export async function triggerSync(dryRun: boolean): Promise<SyncResult> {
  const res = await api.post<{ data: SyncResult }>(
    "/admin/v1/capability/sync-jobs",
    { dry_run: dryRun },
  );
  return res.data.data;
}

// ---- adapter 画像 ----

export interface ProfileDeclaration {
  capability_key: string;
  support_level: SupportLevel;
  limits: unknown | null;
}

export interface AdapterProfile {
  key: string;
  provider: string;
  protocol: string;
  declarations: ProfileDeclaration[];
}

export interface SeedResult {
  model_id: number;
  profile_key: string;
  provider: string;
  protocol: string;
  materialized: number;
}

export async function listAdapterProfiles(): Promise<AdapterProfile[]> {
  const res = await api.get<{ data: AdapterProfile[] }>(
    "/admin/v1/capability/adapter-profiles",
  );
  return res.data.data;
}

export async function materializeAdapterSeed(
  modelId: number,
  profileKey: string,
): Promise<SeedResult> {
  const res = await api.post<{ data: SeedResult }>(
    "/admin/v1/capability/adapter-seed-jobs",
    { model_id: modelId, profile_key: profileKey },
  );
  return res.data.data;
}

