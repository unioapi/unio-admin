// 运维控制台共用时间区间：预设（今天/昨天/近 N 天/本月等）+ 自定义日历。
// 后端 from/to 为 RFC3339，半开区间 [from, to)。

export type RangePreset =
  | "today"
  | "yesterday"
  | "24h"
  | "7d"
  | "14d"
  | "30d"
  | "this_month"
  | "last_month"
  // 旧 URL 兼容（下拉不再展示，解析仍有效）。
  | "5m"
  | "1h"
  | "custom";

export type RangeBucket = "minute" | "hour" | "day";

export interface RangeValue {
  preset: RangePreset;
  // 仅 custom 使用；RFC3339（UTC）。
  from?: string;
  to?: string;
}

/** 截图样式下拉里展示的预设（2×4 网格）。 */
export const RANGE_PRESETS: {
  value: Exclude<RangePreset, "custom" | "5m" | "1h">;
  label: string;
}[] = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "24h", label: "近24小时" },
  { value: "7d", label: "近 7 天" },
  { value: "14d", label: "近 14 天" },
  { value: "30d", label: "近 30 天" },
  { value: "this_month", label: "本月" },
  { value: "last_month", label: "上月" },
];

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalMonth(d: Date): Date {
  return startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** YYYY/MM/DD（本地日期，供筛选器展示）。 */
export function formatLocalDateSlash(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function rangePresetLabel(preset: RangePreset): string {
  if (preset === "custom") return "自定义";
  const hit = RANGE_PRESETS.find((p) => p.value === preset);
  if (hit) return hit.label;
  if (preset === "5m") return "5 分钟";
  if (preset === "1h") return "1 小时";
  return "时间范围";
}

// 把区间解析为后端查询参数。
export function rangeParams(v: RangeValue): { from?: string; to?: string } {
  if (v.preset === "custom") {
    return { from: v.from, to: v.to };
  }

  const now = new Date();
  const todayStart = startOfLocalDay(now);

  switch (v.preset) {
    case "today":
      return { from: todayStart.toISOString(), to: now.toISOString() };
    case "yesterday": {
      const yStart = new Date(todayStart);
      yStart.setDate(yStart.getDate() - 1);
      return { from: yStart.toISOString(), to: todayStart.toISOString() };
    }
    case "5m": {
      const from = new Date(now);
      from.setMinutes(from.getMinutes() - 5);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "1h": {
      const from = new Date(now);
      from.setHours(from.getHours() - 1);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "24h": {
      const from = new Date(now);
      from.setHours(from.getHours() - 24);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "14d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 14);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "this_month":
      return { from: startOfLocalMonth(now).toISOString(), to: now.toISOString() };
    case "last_month": {
      const thisMonth = startOfLocalMonth(now);
      const lastMonth = startOfLocalMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );
      return { from: lastMonth.toISOString(), to: thisMonth.toISOString() };
    }
    default:
      return { from: todayStart.toISOString(), to: now.toISOString() };
  }
}

// 趋势/聚合桶粒度。
export function rangeBucket(v: RangeValue): RangeBucket {
  if (v.preset === "5m" || v.preset === "1h") return "minute";
  if (
    v.preset === "14d" ||
    v.preset === "30d" ||
    v.preset === "this_month" ||
    v.preset === "last_month"
  ) {
    return "day";
  }
  if (v.preset === "custom" && v.from && v.to) {
    const days =
      (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000;
    if (days <= 1 / 24) return "minute";
    return days > 8 ? "day" : "hour";
  }
  // today / yesterday / 24h / 7d
  return "hour";
}

// 上一等长周期 [from - duration, from)，用于趋势环比。
export function previousPeriodParams(params: {
  from?: string;
  to?: string;
}): { from: string; to: string } | null {
  if (!params.from || !params.to) return null;
  const fromMs = new Date(params.from).getTime();
  const toMs = new Date(params.to).getTime();
  const duration = toMs - fromMs;
  if (duration <= 0) return null;
  return {
    from: new Date(fromMs - duration).toISOString(),
    to: new Date(fromMs).toISOString(),
  };
}
