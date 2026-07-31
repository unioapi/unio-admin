/** 请求 Sticky 观测：维 A（选路结果）+ 维 B（绑定变更）。 */

export type StickyOutcome =
  | "no_key"
  | "pinned"
  | "pinned_non_preferred"
  | "key_miss";

export type StickyMutation =
  | "bind"
  | "refresh"
  | "clear"
  | "preserve"
  | "unchanged"
  | "disabled"
  | "conflict"
  | "store_unavailable"
  | "unknown";

/** 列表 / 详情共用的 sticky 摘要字段。 */
export interface StickySummaryFields {
  sticky_key_present: boolean | null;
  sticky_action?: string | null;
  sticky_reason?: string | null;
  sticky_before_channel_id?: number | null;
  sticky_after_channel_id?: number | null;
  sticky_pinned?: boolean | null;
  sticky_pinned_non_preferred?: boolean | null;
  sticky_before_channel_name?: string | null;
  sticky_after_channel_name?: string | null;
}

const OUTCOME_LABELS: Record<StickyOutcome, string> = {
  no_key: "无键",
  pinned: "命中",
  pinned_non_preferred: "非首选命中",
  key_miss: "有键未命中",
};

const MUTATION_LABELS: Record<StickyMutation, string> = {
  bind: "建绑",
  refresh: "续期",
  clear: "清绑",
  preserve: "保留",
  unchanged: "未改",
  disabled: "未启用",
  conflict: "CAS 冲突",
  store_unavailable: "存储不可用",
  unknown: "未知",
};

/** 后端 sticky_action → 维 B。 */
const ACTION_TO_MUTATION: Record<string, StickyMutation> = {
  bind_if_absent: "bind",
  refresh_if_current: "refresh",
  clear_if_current: "clear",
  preserve_on_temporary_bypass: "preserve",
  hit: "unchanged",
  miss: "unchanged",
  disabled: "disabled",
  cas_conflict: "conflict",
  store_unavailable: "store_unavailable",
  // 兼容旧/误标文案
  bind: "bind",
  refresh: "refresh",
  clear: "clear",
  preserve: "preserve",
  none: "unchanged",
};

export function stickyOutcomeLabel(outcome: StickyOutcome): string {
  return OUTCOME_LABELS[outcome];
}

export function stickyMutationLabel(mutation: StickyMutation): string {
  return MUTATION_LABELS[mutation];
}

export function stickyActionLabel(action: string | null | undefined): string {
  if (!action) return MUTATION_LABELS.unchanged;
  return MUTATION_LABELS[ACTION_TO_MUTATION[action] ?? "unknown"] ?? action;
}

/** 无 trace 时返回 null（列表显示 —）。 */
export function resolveStickyOutcome(
  fields: StickySummaryFields,
): StickyOutcome | null {
  if (fields.sticky_key_present == null) return null;
  if (!fields.sticky_key_present) return "no_key";
  if (fields.sticky_pinned) {
    return fields.sticky_pinned_non_preferred
      ? "pinned_non_preferred"
      : "pinned";
  }
  return "key_miss";
}

export function resolveStickyMutation(
  action: string | null | undefined,
): StickyMutation | null {
  if (action == null || action === "") return null;
  return ACTION_TO_MUTATION[action] ?? "unknown";
}

export function channelBindingLabel(
  channelId: number | null | undefined,
  channelName?: string | null,
  version?: number | null,
): string {
  if (channelId == null || channelId <= 0) return "无";
  const name = channelName?.trim() || `#${channelId}`;
  if (version != null && version > 0) return `${name} · v${version}`;
  return name;
}
