import { api } from "@/lib/api/client";
import type { ListMeta, ListParams, Page } from "@/lib/api/types";

// 采纳目录追更状态（阶段 14）：未采纳模型为 null。
export interface ModelCatalogState {
  canonical_id: string;
  update_available: boolean;
  removed_upstream: boolean;
  should_remind: boolean;
  reminder: {
    muted: boolean;
    snooze_until: string | null;
    dismissed: boolean;
  };
}

// 与后端 modelDTO 对齐。source：manual=空白手建；catalog=从 models.dev 目录采纳（采纳后仍可编辑）。
// 元数据（上下文/价格基线/发布日期）为快照展示、不参与计费。
export interface Model {
  id: number;
  model_id: string;
  display_name: string;
  owned_by: string;
  status: string;
  max_output_tokens: number | null;
  context_window_tokens: number | null;
  input_price_usd_per_million_tokens: string | null;
  output_price_usd_per_million_tokens: string | null;
  release_date: string | null;
  source: string;
  catalog: ModelCatalogState | null;
  created_at: string;
  updated_at: string;
}

// 服务端分页：过滤/翻页下沉到后端 SQL。has_update=true 时仅列「应提醒」的采纳模型。
export async function listModels(
  params: ListParams & { hasUpdate?: boolean },
): Promise<Page<Model>> {
  const res = await api.get<{ data: Model[]; meta: ListMeta }>(
    "/admin/v1/models",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        status: params.status,
        q: params.q || undefined,
        has_update: params.hasUpdate ? "true" : undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// 读取单条模型完整配置（抽屉/编辑前回填）。
export async function getModel(id: number): Promise<Model> {
  const res = await api.get<{ data: Model }>(`/admin/v1/models/${id}`);
  return res.data.data;
}

// 给「渠道绑定模型」的下拉用：一次拉满（上限 100），默认只取启用中的模型。
export async function listAllModels(
  status: "enabled" | "disabled" = "enabled",
): Promise<Model[]> {
  const { items } = await listModels({ page: 1, pageSize: 100, status });
  return items;
}

// 可选展示元数据（手建可填、采纳带入、刷新覆盖）；价格为十进制字符串，发布日期 YYYY-MM-DD。
export interface ModelMetadataInput {
  max_output_tokens?: number | null;
  context_window_tokens?: number | null;
  input_price_usd_per_million_tokens?: string | null;
  output_price_usd_per_million_tokens?: string | null;
  release_date?: string | null;
}

// model_id 创建后不可改（对外稳定标识）；lab 已退役（统一用 owned_by）。
export interface CreateModelInput extends ModelMetadataInput {
  model_id: string;
  display_name: string;
  owned_by: string;
  status: string;
}

export async function createModel(input: CreateModelInput): Promise<Model> {
  const res = await api.post<{ data: Model }>("/admin/v1/models", input);
  return res.data.data;
}

export interface UpdateModelInput extends ModelMetadataInput {
  id: number;
  display_name: string;
  owned_by: string;
  status: string;
}

export async function updateModel({
  id,
  ...body
}: UpdateModelInput): Promise<Model> {
  const res = await api.patch<{ data: Model }>(`/admin/v1/models/${id}`, body);
  return res.data.data;
}

// 删除模型：录错的脏数据可真删（model_id 随之释放，可重录同名），后端在同一事务内级联清理
// 它自身的售价/绑定/成本价/能力声明/项目可见性策略/目录关联；一旦被请求/账务历史引用，后端返回 409。
export async function deleteModel(id: number): Promise<void> {
  await api.delete(`/admin/v1/models/${id}`);
}
