import { api } from "@/lib/api/client";

// 与后端 channelModelDTO 对齐。绑定是路由边：某条渠道能服务哪个 Unio 模型、
// 转发到上游时改写成什么模型名（upstream_model）。
// model_external_id / model_display_name 由列表接口 JOIN models 带出，便于展示。
export interface ChannelModel {
  id: number;
  channel_id: number;
  model_id: number;
  model_external_id: string;
  model_display_name: string;
  upstream_model: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// 绑定数量天然很少（一条渠道挂的模型有限），列表不分页，直接返回数组。
export async function listChannelModels(
  channelId: number,
): Promise<ChannelModel[]> {
  const res = await api.get<{ data: ChannelModel[] }>(
    `/admin/v1/channels/${channelId}/models`,
  );
  return res.data.data;
}

export interface CreateChannelModelInput {
  channelId: number;
  model_id: number;
  upstream_model: string;
  status: string;
}

export async function createChannelModel({
  channelId,
  ...body
}: CreateChannelModelInput): Promise<ChannelModel> {
  const res = await api.post<{ data: ChannelModel }>(
    `/admin/v1/channels/${channelId}/models`,
    body,
  );
  return res.data.data;
}

// 按 (channelId, modelId) 定位；可改 upstream_model 与启停状态。
export interface UpdateChannelModelInput {
  channelId: number;
  modelId: number;
  upstream_model: string;
  status: string;
  verification_item_id?: number;
}

export async function updateChannelModel({
  channelId,
  modelId,
  ...body
}: UpdateChannelModelInput): Promise<ChannelModel> {
  const res = await api.patch<{ data: ChannelModel }>(
    `/admin/v1/channels/${channelId}/models/${modelId}`,
    body,
  );
  return res.data.data;
}

// 删除绑定：未被账务引用的可真删；已被引用时后端返回 409，提示改用停用。
export async function deleteChannelModel(
  channelId: number,
  modelId: number,
): Promise<void> {
  await api.delete(`/admin/v1/channels/${channelId}/models/${modelId}`);
}
