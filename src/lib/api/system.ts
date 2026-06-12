import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";

// 与后端 M8 system handler DTO 对齐。
// settlement recovery job：上游成功且已有可靠 usage、但 settlement 确认前的持久化补偿任务。
// 列表项绝不含 last_internal_error_detail（存储层即脱敏）；金额为十进制字符串。

export interface RecoveryJobSummary {
  id: number;
  user_id: number;
  request_record_id: number;
  attempt_id: number;
  reservation_id: number;
  response_protocol: string;
  response_id: string;
  response_model_id: string;
  model_id: number;
  provider_id: number;
  channel_id: number;
  upstream_protocol: string;
  upstream_model: string;
  finish_class: string;
  upstream_status_code: number;
  currency: string;
  estimated_amount: string;
  authorized_amount: string;
  status: string; // pending / running / succeeded / dead
  attempt_count: number;
  max_attempts: number;
  next_run_at: string;
  locked_by: string | null;
  locked_until: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_attempted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 详情：摘要 + 审计补充字段 + 受控内部诊断详情（仅 includeInternal=true 时回显）。
export interface RecoveryJobDetail extends RecoveryJobSummary {
  upstream_response_id: string;
  upstream_finish_reason: string;
  upstream_request_id: string | null;
  usage_source: string;
  usage_mapping_version: string;
  formula_version: string;
  pricing_unit: string;
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_write_5m_input_tokens: number;
  cache_write_1h_input_tokens: number;
  output_tokens_total: number;
  reasoning_output_tokens: number;
  last_internal_error_detail?: string | null;
}

export interface RecoveryJobListParams {
  page: number;
  pageSize: number;
  status?: string;
  userId?: number;
  from?: string;
  to?: string;
}

export async function listRecoveryJobs(
  params: RecoveryJobListParams,
): Promise<Page<RecoveryJobSummary>> {
  const res = await api.get<{ data: RecoveryJobSummary[]; meta: ListMeta }>(
    "/admin/v1/system/settlement-recovery-jobs",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        status: params.status || undefined,
        user_id: params.userId || undefined,
        from: params.from || undefined,
        to: params.to || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

// 详情按主键定位；includeInternal=true 才回显 last_internal_error_detail。
export async function getRecoveryJob(
  id: number,
  includeInternal = false,
): Promise<RecoveryJobDetail> {
  const res = await api.get<{ data: RecoveryJobDetail }>(
    `/admin/v1/system/settlement-recovery-jobs/${id}`,
    { params: { include_internal: includeInternal ? "true" : undefined } },
  );
  return res.data.data;
}

// 系统级 channel 健康：从区间内 request_attempts 成功率派生（非熔断器实时态）。
export type ChannelHealthBucket =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "no_data";

export interface ChannelHealth {
  channel_id: number;
  name: string;
  status: string;
  provider_id: number;
  attempt_total: number;
  attempt_succeeded: number;
  attempt_failed: number;
  attempt_canceled: number;
  success_rate: number;
  last_attempt_at: string | null;
  bucket: ChannelHealthBucket;
}

export async function listChannelHealth(params?: {
  from?: string;
  to?: string;
}): Promise<ChannelHealth[]> {
  const res = await api.get<{ data: ChannelHealth[] }>(
    "/admin/v1/system/channel-health",
    { params: { from: params?.from || undefined, to: params?.to || undefined } },
  );
  return res.data.data;
}
