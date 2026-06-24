import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";
import type { Model } from "@/lib/api/models";

// models.dev 参考目录条目（运行时不读，仅供浏览与采纳预填）。
export interface CatalogEntry {
  canonical_id: string;
  lab: string;
  display_name: string;
  context_window_tokens: number | null;
  max_output_tokens: number | null;
  input_price_usd_per_million_tokens: string | null;
  output_price_usd_per_million_tokens: string | null;
  release_date: string | null;
  removed_upstream: boolean;
  fingerprint: string;
  capability_count: number;
  adopted_count: number;
}

export interface CatalogCapabilityHint {
  capability_key: string;
  support_level: "full" | "limited" | "unsupported";
  limits: unknown | null;
}

export interface CatalogEntryDetail extends CatalogEntry {
  capabilities: CatalogCapabilityHint[];
}

export interface ListCatalogParams {
  page: number;
  pageSize: number;
  q?: string;
  lab?: string;
}

export async function listCatalog(
  params: ListCatalogParams,
): Promise<Page<CatalogEntry>> {
  const res = await api.get<{ data: CatalogEntry[]; meta: ListMeta }>(
    "/admin/v1/model-catalog",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        q: params.q || undefined,
        lab: params.lab || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// canonical_id 含 '/'，作为通配段拼接（不要 encodeURIComponent，否则斜杠会被转义）。
export async function getCatalogEntry(
  canonicalID: string,
): Promise<CatalogEntryDetail> {
  const res = await api.get<{ data: CatalogEntryDetail }>(
    `/admin/v1/model-catalog/${canonicalID}`,
  );
  return res.data.data;
}

export interface AdoptFromCatalogInput {
  canonical_id: string;
  model_id: string;
  display_name: string;
  owned_by: string;
  status: string;
  max_output_tokens?: number | null;
  context_window_tokens?: number | null;
  input_price_usd_per_million_tokens?: string | null;
  output_price_usd_per_million_tokens?: string | null;
  release_date?: string | null;
  capabilities: CatalogCapabilityHint[];
}

export async function createModelFromCatalog(
  input: AdoptFromCatalogInput,
): Promise<Model> {
  const res = await api.post<{ data: Model }>(
    "/admin/v1/models/from-catalog",
    input,
  );
  return res.data.data;
}

