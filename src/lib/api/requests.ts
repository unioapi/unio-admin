import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";

// 与后端 requestSummaryDTO 对齐；列表项不含 internal_error_detail（存储层即脱敏）。
export interface RequestSummary {
  id: number;
  request_id: string;
  user_id: number;
  api_key_id: number;
  requested_model_id: string;
  ingress_protocol: string;
  operation: string;
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
  final_usage_received: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// 与后端 usageDTO 对齐（请求详情内）。
export interface RequestUsage {
  id: number;
  request_record_id: number;
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_write_5m_input_tokens: number;
  cache_write_1h_input_tokens: number;
  output_tokens_total: number;
  reasoning_output_tokens: number;
  usage_source: string;
  usage_mapping_version: string;
  created_at: string;
}

// 与后端 requestDetailDTO 对齐：请求 + 上游尝试链 + usage + 账本流水 + 计费异常。
export interface RequestDetail extends RequestSummary {
  internal_error_detail?: string | null;
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
): Promise<Page<RequestSummary>> {
  const res = await api.get<{ data: RequestSummary[]; meta: ListMeta }>(
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
