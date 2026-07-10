import { api } from "@/lib/api/client";

// 与后端 channelPriceDTO 对齐（DEC-026：渠道只录成本，客户售价 = 模型基准价 × 线路倍率）。金额一律用十进制字符串承载。
// 主成本 uncached_input_cost/output_cost 必填恒有值；其余成本分项可空（null）。
// model_external_id / model_display_name 仅列表场景由后端 JOIN 带出。
export interface ChannelPrice {
  id: number;
  channel_id: number;
  model_id: number;
  model_external_id: string;
  model_display_name: string;
  currency: string;
  pricing_unit: string;
  uncached_input_cost: string;
  cache_read_input_cost: string | null;
  cache_write_5m_input_cost: string | null;
  cache_write_1h_input_cost: string | null;
  cache_write_30m_input_cost: string | null;
  output_cost: string;
  reasoning_output_cost: string | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

// 价格数量天然有限（渠道挂的模型 × 价格版本），列表不分页。
export async function listChannelPrices(
  channelId: number,
): Promise<ChannelPrice[]> {
  const res = await api.get<{ data: ChannelPrice[] }>(
    `/admin/v1/channels/${channelId}/prices`,
  );
  return res.data.data;
}

/** 取某模型当前生效中的渠道成本价（enabled 且在生效窗口内）。 */
export function pickCurrentChannelPrice(
  prices: ChannelPrice[],
  modelId: number,
): ChannelPrice | null {
  const now = Date.now();
  const candidates = prices.filter((p) => {
    if (p.model_id !== modelId) return false;
    if (p.status !== "enabled") return false;
    if (new Date(p.effective_from).getTime() > now) return false;
    if (p.effective_to && new Date(p.effective_to).getTime() <= now) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
  )[0]!;
}

/**
 * 找出同一模型下、启用中且生效窗口与目标窗口 [from, to) 相交的渠道成本价。
 * 与后端 windowsOverlap 保持一致（半开区间，null 结束时间表示 +∞）。
 * 用于新建成本价前提示「将覆盖现有价」：命中项需先关闭旧窗口再建新价，避免窗口重叠报错。
 * 返回按 effective_from 倒序排列（最近生效的排在最前，便于取「当前价」做对比）。
 */
export function findOverlappingChannelPrices(
  prices: ChannelPrice[],
  modelId: number,
  from: string,
  to: string | null,
  excludeId?: number,
): ChannelPrice[] {
  const aFrom = new Date(from).getTime();
  const aTo = to ? new Date(to).getTime() : null;
  return prices
    .filter((p) => {
      if (excludeId != null && p.id === excludeId) return false;
      if (p.model_id !== modelId) return false;
      if (p.status !== "enabled") return false;
      const bFrom = new Date(p.effective_from).getTime();
      const bTo = p.effective_to ? new Date(p.effective_to).getTime() : null;
      const aStartsBeforeBEnds = bTo == null || aFrom < bTo;
      const bStartsBeforeAEnds = aTo == null || bFrom < aTo;
      return aStartsBeforeBEnds && bStartsBeforeAEnds;
    })
    .sort(
      (a, b) =>
        new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
    );
}

// 主成本必填（uncached_input_cost/output_cost），其余成本分项可空（null）。时间为 RFC3339（UTC）。
export interface CreateChannelPriceInput {
  channelId: number;
  modelId: number;
  currency: string;
  pricing_unit: string;
  uncached_input_cost: string;
  cache_read_input_cost: string | null;
  cache_write_5m_input_cost: string | null;
  cache_write_1h_input_cost: string | null;
  cache_write_30m_input_cost: string | null;
  output_cost: string;
  reasoning_output_cost: string | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
}

export async function createChannelPrice({
  channelId,
  modelId,
  ...body
}: CreateChannelPriceInput): Promise<ChannelPrice> {
  const res = await api.post<{ data: ChannelPrice }>(
    `/admin/v1/channels/${channelId}/models/${modelId}/prices`,
    body,
  );
  return res.data.data;
}

// 价格不可删：只能 PATCH 关闭窗口（改 effective_to）或启停（改 status）；金额不可改。
export interface UpdateChannelPriceInput {
  id: number;
  status: string;
  effective_to: string | null;
}

export async function updateChannelPrice({
  id,
  ...body
}: UpdateChannelPriceInput): Promise<ChannelPrice> {
  const res = await api.patch<{ data: ChannelPrice }>(
    `/admin/v1/channel-prices/${id}`,
    body,
  );
  return res.data.data;
}
