import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";

// 与后端 requestSummaryDTO 对齐；列表项不含 internal_error_detail（存储层即脱敏）。
interface RequestSummary {
  id: number;
  request_id: string;
  user_id: number;
  api_key_id: number;
  requested_model_id: string;
  ingress_protocol: string;
  endpoint: string;
  response_model_id: string | null;
  response_protocol: string | null;
  response_id: string | null;
  stream: boolean;
  status: string;
  final_provider_id: number | null;
  final_channel_id: number | null;
  error_code: string | null;
  error_message: string | null;
  delivery_status: string;
  response_started_at: string | null;
  response_completed_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 与后端 requestListItemDTO 对齐：请求列表项（富化）= 请求事实 + 用量/成本/扣费 + 线路/渠道链 + 时延。
// 费用类为 USD 十进制字符串，无结算快照 / 账本时为 null；latency/ttft 单位 ms，tps 为 t/s。
export interface RequestListItem extends RequestSummary {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_write_5m_input_tokens: number;
  cache_write_1h_input_tokens: number;
  cache_write_30m_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  user_charge_usd: string | null;
  total_cost_usd: string | null;
  uncached_input_cost_usd: string | null;
  cache_read_input_cost_usd: string | null;
  cache_write_5m_input_cost_usd: string | null;
  cache_write_1h_input_cost_usd: string | null;
  cache_write_30m_input_cost_usd: string | null;
  output_cost_usd: string | null;
  reasoning_output_cost_usd: string | null;
  // 计费单价快照（USD 字符串，per_1m_tokens）：平台成本单价×6 + 用户售价单价×6，供「单价×tokens=金额」计算过程。
  uncached_input_cost_unit_usd: string | null;
  cache_read_input_cost_unit_usd: string | null;
  cache_write_5m_input_cost_unit_usd: string | null;
  cache_write_1h_input_cost_unit_usd: string | null;
  cache_write_30m_input_cost_unit_usd: string | null;
  output_cost_unit_usd: string | null;
  reasoning_output_cost_unit_usd: string | null;
  uncached_input_price_unit_usd: string | null;
  cache_read_input_price_unit_usd: string | null;
  cache_write_5m_input_price_unit_usd: string | null;
  cache_write_1h_input_price_unit_usd: string | null;
  cache_write_30m_input_price_unit_usd: string | null;
  output_price_unit_usd: string | null;
  reasoning_output_price_unit_usd: string | null;
  // DEC-027 成本来源倍率快照（倍率路径有值，覆盖/旧数据为 null）：价格倍率 + 充值倍率。
  channel_cost_multiplier: string | null;
  recharge_factor: string | null;
  /** 费用是否已按长上下文倍率结算。 */
  long_context_applied: boolean;
  // 用户/Key：明文供列表点击复制（口径同 api-keys 页）。
  api_key_name: string | null;
  api_key_prefix: string | null;
  api_key_plaintext: string | null;
  route_name: string | null;
  route_price_ratio: string | null;
  route_mode: string | null;
  final_channel_name: string | null;
  channel_chain: string;
  model_display_name: string | null;
  model_owned_by: string | null;
  // 归一推理强度 none/minimal/low/medium/high/xhigh；Anthropic 带原始预算；批二埋点，历史行为 null。
  reasoning_effort: string | null;
  reasoning_budget_tokens: number | null;
  client_ip: string | null;
  latency_ms: number | null;
  ttft_ms: number | null;
  tps: number | null;
}

// 与后端 costSnapshotDTO 对齐：平台成本快照（单价 per_1m_tokens + 金额，USD 字符串）。
interface CostSnapshot {
  uncached_input_cost_unit: string | null;
  cache_read_input_cost_unit: string | null;
  cache_write_5m_input_cost_unit: string | null;
  cache_write_1h_input_cost_unit: string | null;
  cache_write_30m_input_cost_unit: string | null;
  output_cost_unit: string | null;
  reasoning_output_cost_unit: string | null;
  uncached_input_cost_amount: string | null;
  cache_read_input_cost_amount: string | null;
  cache_write_5m_input_cost_amount: string | null;
  cache_write_1h_input_cost_amount: string | null;
  cache_write_30m_input_cost_amount: string | null;
  output_cost_amount: string | null;
  reasoning_output_cost_amount: string | null;
  total_cost_amount: string | null;
  // DEC-027 成本来源倍率（倍率路径有值，覆盖/旧数据为 null）：价格倍率 + 充值倍率。
  channel_cost_multiplier: string | null;
  recharge_factor: string | null;
}

// 与后端 priceSnapshotDTO 对齐：客户售价快照（单价 per_1m_tokens，USD 字符串）。
interface PriceSnapshot {
  uncached_input_price: string | null;
  cache_read_input_price: string | null;
  cache_write_5m_input_price: string | null;
  cache_write_1h_input_price: string | null;
  cache_write_30m_input_price: string | null;
  output_price: string | null;
  reasoning_output_price: string | null;
}

// 与后端 attemptDTO 对齐；internal_error_detail 仅在 include_internal=true 时出现。
export interface Attempt {
  id: number;
  attempt_index: number;
  provider_id: number;
  channel_id: number;
  adapter_key: string;
  upstream_model: string;
  upstream_protocol: string;
  upstream_response_id: string | null;
  upstream_response_model: string | null;
  upstream_finish_reason: string | null;
  finish_class: string | null;
  status: string;
  // 归因：upstream（上游/渠道）/ client（客户端）/ platform（平台）；成功或进行中为 null。
  fault_party: string | null;
  upstream_status_code: number | null;
  upstream_request_id: string | null;
  error_code: string | null;
  error_message: string | null;
  internal_error_detail?: string | null;
  response_started_at: string | null;
  /** 完整上游 transport 耗时，只由 upstream_completed_at - upstream_started_at 派生。 */
  upstream_total_ms: number | null;
  /** 流式上游首 Token 耗时；非流式恒为 null。 */
  upstream_ttft_ms: number | null;
  final_usage_received: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// 与后端 usageDTO 对齐（请求详情内）。
interface RequestUsage {
  id: number;
  request_record_id: number;
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_write_5m_input_tokens: number;
  cache_write_1h_input_tokens: number;
  cache_write_30m_input_tokens: number;
  output_tokens_total: number;
  reasoning_output_tokens: number;
  usage_source: string;
  usage_mapping_version: string;
  created_at: string;
}

// 与后端 requestDetailDTO 对齐：请求 + 上游尝试链 + usage + 账本流水 + 计费异常。
export interface RequestDetail extends RequestSummary {
  internal_error_detail?: string | null;
  route_id: number | null;
  reasoning_effort: string | null;
  reasoning_budget_tokens: number | null;
  client_ip: string | null;
  cost_snapshot: CostSnapshot | null;
  price_snapshot: PriceSnapshot | null;
  route_price_ratio: string | null;
  route_mode: string | null;
  attempts: Attempt[];
  usage: RequestUsage | null;
  ledger_entries: LedgerEntry[];
  billing_exception: BillingException | null;
}

export interface RequestListParams {
  page: number;
  pageSize: number;
  sort?: string;
  status?: string;
  model?: string;
  userId?: number;
  apiKeyId?: number;
  from?: string;
  to?: string;
}

export async function listRequests(
  params: RequestListParams,
): Promise<Page<RequestListItem>> {
  const res = await api.get<{ data: RequestListItem[]; meta: ListMeta }>(
    "/admin/v1/requests",
    {
      params: buildListQuery({
        page: params.page,
        page_size: params.pageSize,
        sort: params.sort,
        status: params.status,
        model: params.model,
        user_id: params.userId,
        api_key_id: params.apiKeyId,
        from: params.from,
        to: params.to,
      }),
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// 详情按对外 request_id 定位；includeInternal=true 才回显内部错误详情（请求级与 attempt 级）。
export async function getRequest(
  requestId: string,
  includeInternal = false,
): Promise<RequestDetail> {
  const res = await api.get<{ data: RequestDetail }>(
    `/admin/v1/requests/${encodeURIComponent(requestId)}`,
    { params: { include_internal: includeInternal ? "true" : undefined } },
  );
  return res.data.data;
}
