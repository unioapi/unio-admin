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
  | "recent_error"
  | "action";

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
    "requests",
    "success_rate",
    "channels",
    "tokens",
    "margin",
    "latency",
    "action",
  ],
  channel: [
    "name",
    "health",
    "requests",
    "success_rate",
    "margin",
    "recent_error",
    "latency",
    "action",
  ],
  model: [
    "name",
    "requests",
    "success_rate",
    "tokens",
    "margin",
    "failed",
    "action",
  ],
  route: [
    "name",
    "status",
    "requests",
    "failed",
    "success_rate",
    "margin",
    "recent_error",
    "action",
  ],
};

export const BREAKDOWN_COLUMN_LABEL: Record<
  Exclude<BreakdownColumnId, "name" | "action">,
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
  recent_error: "最近错误",
};

export const BREAKDOWN_COLUMN_SIZE: Record<BreakdownColumnId, number> = {
  name: 180,
  status: 88,
  health: 88,
  requests: 96,
  succeeded: 80,
  failed: 80,
  success_rate: 96,
  channels: 96,
  tokens: 104,
  margin: 108,
  latency: 112,
  recent_error: 160,
  action: 80,
};

/** 持久化列宽的下限，避免拖拽/旧数据把列压到不可读。 */
export const BREAKDOWN_COLUMN_MIN_SIZE: Record<BreakdownColumnId, number> = {
  name: 120,
  status: 72,
  health: 72,
  requests: 72,
  succeeded: 64,
  failed: 64,
  success_rate: 80,
  channels: 72,
  tokens: 80,
  margin: 88,
  latency: 96,
  recent_error: 120,
  action: 72,
};

export const BREAKDOWN_REF_PARAM: Record<BreakdownDimension, string> = {
  provider: "provider_id",
  channel: "channel_id",
  model: "model_id",
  route: "route_id",
};

export const BREAKDOWN_LINK: Record<BreakdownDimension, string> = {
  provider: "/providers",
  channel: "/channels",
  model: "/models",
  route: "/routes",
};

export const STATUS_LABEL: Record<string, string> = {
  enabled: "启用",
  disabled: "停用",
};

export const ERROR_CODE_LABEL: Record<string, string> = {
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

export function breakdownColumnLabels(
  dimension: BreakdownDimension,
  nameLabel: string,
): Record<string, string> {
  const labels: Record<string, string> = { name: nameLabel, action: "操作" };
  for (const id of BREAKDOWN_COLUMNS[dimension]) {
    if (id === "name" || id === "action") continue;
    labels[id] = BREAKDOWN_COLUMN_LABEL[id];
  }
  return labels;
}
