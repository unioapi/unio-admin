import { api } from "@/lib/api/client";

// 与后端 modelPriceDTO 对齐（DEC-026：模型基准售价；客户售价 = 基准价 × 线路倍率）。金额一律用十进制字符串承载。
// 主售价 uncached_input_price/output_price 必填恒有值；其余分项可空（null）。
// model_external_id / model_display_name 仅列表场景由后端 JOIN 带出。
export interface ModelPrice {
  id: number;
  model_id: number;
  model_external_id: string;
  model_display_name: string;
  currency: string;
  pricing_unit: string;
  uncached_input_price: string;
  cache_read_input_price: string | null;
  cache_write_5m_input_price: string | null;
  cache_write_1h_input_price: string | null;
  cache_write_30m_input_price: string | null;
  output_price: string;
  reasoning_output_price: string | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

// 价格数量天然有限（模型 × 价格版本），列表不分页。
export async function listModelPrices(modelId: number): Promise<ModelPrice[]> {
  const res = await api.get<{ data: ModelPrice[] }>(
    `/admin/v1/models/${modelId}/prices`,
  );
  return res.data.data;
}

// 主售价必填（uncached_input_price/output_price），其余分项可空（null）。时间为 RFC3339（UTC）。
export interface CreateModelPriceInput {
  modelId: number;
  currency: string;
  pricing_unit: string;
  uncached_input_price: string;
  cache_read_input_price: string | null;
  cache_write_5m_input_price: string | null;
  cache_write_1h_input_price: string | null;
  cache_write_30m_input_price: string | null;
  output_price: string;
  reasoning_output_price: string | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
}

export async function createModelPrice({
  modelId,
  ...body
}: CreateModelPriceInput): Promise<ModelPrice> {
  const res = await api.post<{ data: ModelPrice }>(
    `/admin/v1/models/${modelId}/prices`,
    body,
  );
  return res.data.data;
}

// 价格不可删：只能 PATCH 关闭窗口（改 effective_to）或启停（改 status）；金额不可改。
export interface UpdateModelPriceInput {
  id: number;
  status: string;
  effective_to: string | null;
}

export async function updateModelPrice({
  id,
  ...body
}: UpdateModelPriceInput): Promise<ModelPrice> {
  const res = await api.patch<{ data: ModelPrice }>(
    `/admin/v1/model-prices/${id}`,
    body,
  );
  return res.data.data;
}
