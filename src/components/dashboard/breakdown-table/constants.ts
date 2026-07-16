import type { BreakdownDimension } from "@/lib/api/dashboard";

export type BreakdownColumnId =
  | "name"
  | "status"
  | "health"
  | "requests"
  | "succeeded"
  | "failed"
  | "success_rate"
  | "channels"
  | "tokens"
  | "margin"
  | "latency"
  | "tps"
  | "recent_error";

export const BREAKDOWN_TABS: { value: BreakdownDimension; label: string }[] = [
  { value: "provider", label: "服务商" },
  { value: "channel", label: "渠道" },
  { value: "model", label: "模型" },
  { value: "route", label: "线路" },
];

export const BREAKDOWN_COLUMNS: Record<
  BreakdownDimension,
  BreakdownColumnId[]
> = {
  provider: [
    "name",
    "status",
    "channels",
    "requests",
    "success_rate",
    "latency",
    "tps",
    "tokens",
    "margin",
  ],
  channel: [
    "name",
    "health",
    "requests",
    "tokens",
    "margin",
    "latency",
    "tps",
    "success_rate",
  ],
  model: [
    "name",
    "requests",
    "success_rate",
    "tokens",
    "margin",
    "failed",
  ],
  route: [
    "name",
    "status",
    "requests",
    "failed",
    "success_rate",
    "margin",
    "recent_error",
  ],
};

const BREAKDOWN_COLUMN_LABEL: Record<
  Exclude<BreakdownColumnId, "name">,
  string
> = {
  status: "状态",
  health: "健康",
  requests: "请求",
  succeeded: "成功",
  failed: "失败",
  success_rate: "成功率",
  channels: "渠道数",
  tokens: "Token",
  margin: "利润",
  latency: "P95 延迟",
  tps: "平均 TPS",
  recent_error: "最近错误",
};

export const BREAKDOWN_COLUMN_SIZE: Record<BreakdownColumnId, number> = {
  name: 160,
  status: 72,
  health: 88,
  requests: 80,
  succeeded: 80,
  failed: 80,
  success_rate: 92,
  channels: 84,
  tokens: 88,
  margin: 88,
  latency: 108,
  tps: 96,
  recent_error: 160,
};

/** 持久化列宽的下限，避免拖拽/旧数据把列压到不可读。 */
export const BREAKDOWN_COLUMN_MIN_SIZE: Record<BreakdownColumnId, number> = {
  name: 120,
  status: 64,
  health: 72,
  requests: 64,
  succeeded: 64,
  failed: 64,
  success_rate: 80,
  channels: 72,
  tokens: 72,
  margin: 72,
  latency: 88,
  tps: 80,
  recent_error: 120,
};

export const STATUS_LABEL: Record<string, string> = {
  enabled: "启用",
  disabled: "停用",
  archived: "已归档",
};

const ERROR_CODE_LABEL: Record<string, string> = {
  unknown: "未知错误",
  no_available_channel: "无可用渠道",
  routing_no_available_channel: "无可用渠道",
  model_not_found: "模型不存在",
  model_not_available: "模型暂不可用",
  insufficient_balance: "余额不足",
  ledger_insufficient_balance: "余额不足",
  context_deadline_exceeded: "上游超时",
  gateway_stream_usage_missing: "流式用量缺失",
  gateway_chat_settlement_failed: "结算失败",
  gateway_chat_authorization_failed: "授权失败",
  gateway_request_orphan_reclaimed: "孤儿请求清扫",
  adapter_upstream_status: "上游 HTTP 异常",
  adapter_send_request_failed: "上游请求失败",
  adapter_decode_response_failed: "上游响应解析失败",
  adapter_read_stream_failed: "上游流读取失败",
  client_canceled: "客户端取消",
};

export function errorCodeLabel(code: string): string {
  if (ERROR_CODE_LABEL[code]) return ERROR_CODE_LABEL[code];
  if (/timeout/i.test(code)) return "上游超时";
  return code;
}

/**
 * 量级列名随维度切换：服务商/渠道按 attempt（尝试）粒度归因，故称「尝试」；
 * 模型/线路为请求粒度，称「请求」。避免同名「请求」掩盖不同口径。
 */
export function requestsCountLabel(dimension: BreakdownDimension): string {
  return dimension === "provider" || dimension === "channel" ? "尝试" : "请求";
}

export function breakdownColumnLabels(
  dimension: BreakdownDimension,
  nameLabel: string,
): Record<string, string> {
  const labels: Record<string, string> = { name: nameLabel };
  for (const id of BREAKDOWN_COLUMNS[dimension]) {
    if (id === "name") continue;
    labels[id] =
      id === "requests" ? requestsCountLabel(dimension) : BREAKDOWN_COLUMN_LABEL[id];
  }
  return labels;
}
