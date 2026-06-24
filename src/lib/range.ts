// 运维控制台共用的时间区间模型（§3.1：短窗口 / 24H / 3D / 7D / 30D / 全部；默认 24H）。
// 后端 from/to 为 RFC3339，半开区间 [from, to)；「全部」省略 from/to。

export type RangePreset =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "24h"
  | "3d"
  | "7d"
  | "30d"
  | "all"
  | "custom";

export type RangeBucket = "minute" | "hour" | "day";

export interface RangeValue {
  preset: RangePreset;
  // 仅 custom 使用；RFC3339（UTC）。
  from?: string;
  to?: string;
}

export const RANGE_PRESETS: {
  value: Exclude<RangePreset, "custom">;
  label: string;
}[] = [
  { value: "5m", label: "5分钟" },
  { value: "15m", label: "15分钟" },
  { value: "30m", label: "30分钟" },
  { value: "1h", label: "1小时" },
  { value: "24h", label: "24H" },
  { value: "3d", label: "3D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "全部" },
];

export const DEFAULT_RANGE: RangeValue = { preset: "24h" };

// 把区间解析为后端查询参数。「全部」返回空对象（不限）。
export function rangeParams(v: RangeValue): { from?: string; to?: string } {
  if (v.preset === "custom") {
    return { from: v.from, to: v.to };
  }
  if (v.preset === "all") return {};
  const to = new Date();
  const from = new Date(to);
  switch (v.preset) {
    case "5m":
      from.setMinutes(from.getMinutes() - 5);
      break;
    case "15m":
      from.setMinutes(from.getMinutes() - 15);
      break;
    case "30m":
      from.setMinutes(from.getMinutes() - 30);
      break;
    case "1h":
      from.setHours(from.getHours() - 1);
      break;
    case "24h":
      from.setHours(from.getHours() - 24);
      break;
    case "3d":
      from.setDate(from.getDate() - 3);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

// 趋势/聚合桶粒度：分钟窗口 → minute；24H/3D/7D → hour；30D/全部 → day。
export function rangeBucket(v: RangeValue): RangeBucket {
  if (v.preset === "all" || v.preset === "30d") return "day";
  if (v.preset === "5m" || v.preset === "15m" || v.preset === "30m" || v.preset === "1h") {
    return "minute";
  }
  if (v.preset === "custom" && v.from && v.to) {
    const days =
      (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000;
    if (days <= 1 / 24) return "minute";
    return days > 8 ? "day" : "hour";
  }
  return "hour";
}
