import { api } from "@/lib/api/client";
import { buildListQuery } from "@/lib/api/list-params";
import type { ListMeta, Page } from "@/lib/api/types";
import type { RuntimeSyncState } from "@/lib/api/runtime";

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

  // 对外 request_id（req_xxx）：供后台跳转到对应请求详情；缺失为空串。
  request_public_id: string;

  // 资金闭环（关联预授权/超额补扣流水派生）：冻结(authorized)→ 实扣(captured+overage)→ 释放(released)。
  // reservation_status: authorized=未结算 / captured=已实扣 / released=已全额释放(dead 收口)。
  reservation_status: "authorized" | "captured" | "released" | "";
  captured_amount: string;
  released_amount: string;
  overage_amount: string;
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
  cache_write_30m_input_tokens: number;
  output_tokens_total: number;
  reasoning_output_tokens: number;
  last_internal_error_detail?: string | null;
}

export interface RecoveryJobListParams {
  page: number;
  pageSize: number;
  sort?: string;
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
      params: buildListQuery({
        page: params.page,
        page_size: params.pageSize,
        sort: params.sort,
        status: params.status,
        user_id: params.userId,
        from: params.from,
        to: params.to,
      }),
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

// 网关配置只读面板：进程级 env 生效阈值（脱敏，绝不含凭据/密钥/连接串）。
// 与后端 systemConfigDTO 对齐：分组 + 每项 {label, value, env}。
interface SystemConfigEntry {
  label: string;
  value: string;
  env: string;
}

interface SystemConfigGroup {
  title: string;
  entries: SystemConfigEntry[];
}

export interface SystemConfig {
  note: string;
  groups: SystemConfigGroup[];
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const res = await api.get<{ data: SystemConfig }>("/admin/v1/system/config");
  return res.data.data;
}

export interface RuntimeOperationSummary {
  nonterminal_count: number;
  oldest_age_seconds: number | null;
}

// 维护诊断只保留脱敏事实：类型中不得加入随机 epoch、operation token 或 hash。
export interface RuntimeDiagnostics {
  readiness: {
    ready: boolean;
    reason: string;
  };
  runtime_state_epoch: {
    state: string;
    revision: number;
    match: boolean;
  };
  operations: {
    origin_routing: RuntimeOperationSummary;
    runtime_control: RuntimeOperationSummary;
  };
}

export async function getRuntimeDiagnostics(): Promise<RuntimeDiagnostics> {
  const res = await api.get<{ data: RuntimeDiagnostics }>(
    "/admin/v1/system/runtime-diagnostics",
  );
  return res.data.data;
}

// Provider 全局设置（可编辑）：Anthropic beta 转发策略。与后端 anthropicBetaPolicyDTO 对齐。
// mode：passthrough（全透传）/ filter（黑名单）/ whitelist（白名单）。
// list：filter 当黑名单、whitelist 当白名单；passthrough 忽略。
export type AnthropicBetaMode = "passthrough" | "filter" | "whitelist";

export interface AnthropicBetaPolicy {
  mode: AnthropicBetaMode;
  list: string[];
}

export async function getAnthropicBetaPolicy(): Promise<AnthropicBetaPolicy> {
  const res = await api.get<{ data: AnthropicBetaPolicy }>(
    "/admin/v1/provider-settings/anthropic/beta-policy",
  );
  return res.data.data;
}

export async function updateAnthropicBetaPolicy(
  policy: AnthropicBetaPolicy,
): Promise<AnthropicBetaPolicy> {
  const res = await api.put<{ data: AnthropicBetaPolicy }>(
    "/admin/v1/provider-settings/anthropic/beta-policy",
    policy,
  );
  return res.data.data;
}

// 运行时配置列表的共享 react-query key：设置面板与各消费方（如 useMetricThresholds）
// 共用同一缓存——面板保存后 invalidate，消费方立即拿到新值，无需刷新页面。
export const RUNTIME_SETTINGS_QUERY_KEY = ["runtime-settings"] as const;

// 通用运行时配置项：注册元数据 + 当前生效值 + 生效来源（redis=已跨进程传播 / db / default）。
export interface SettingItem {
  key: string;
  category: string;
  label: string;
  description: string;
  hot_reload: boolean;
  default: unknown;
  value: unknown;
  source: "redis" | "db" | "default" | "";
  revision: number;
  runtime_active_revision?: number;
  runtime_pending_revision?: number;
  runtime_sync_state?: RuntimeSyncState;
}

export interface SettingWriteResult {
  key: string;
  revision: number;
  state: "saved" | "active" | "runtime_sync_pending";
  active_revision: number;
  pending_revision: number;
}

export async function listSettings(): Promise<SettingItem[]> {
  const res = await api.get<{ data: SettingItem[] }>("/admin/v1/settings");
  return res.data.data;
}

// 通用运行时配置写入：body 即该 key 的 JSON 值（后端按注册表校验，非法值 400）。
// 五个关键运行态控制通过 durable Redis control 激活；其余 gateway 设置由 settingsApplier 热更新。
export async function updateSetting(
  key: string,
  value: unknown,
): Promise<SettingWriteResult> {
  const res = await api.put<{
    data:
      | SettingWriteResult
      | {
          Key: string;
          Revision: number;
          State: SettingWriteResult["state"];
          ActiveRevision: number;
          PendingRevision: number;
        };
  }>(`/admin/v1/settings/${encodeURIComponent(key)}`, value, {
    headers: { "Content-Type": "application/json" },
  });
  const result = res.data.data;
  if ("Key" in result) {
    return {
      key: result.Key,
      revision: result.Revision,
      state: result.State,
      active_revision: result.ActiveRevision,
      pending_revision: result.PendingRevision,
    };
  }
  return result;
}
