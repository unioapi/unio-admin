// 运维控制台共用的时间区间模型（§3.1：全部 / 24H / 3D / 7D / 30D；默认 24H）。
// 后端 from/to 为 RFC3339，半开区间 [from, to)；「全部」省略 from/to。

export type RangePreset = "all" | "24h" | "3d" | "7d" | "30d" | "custom";

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
  { value: "all", label: "全部" },
  { value: "24h", label: "24H" },
  { value: "3d", label: "3D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
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

// 趋势/聚合桶粒度（§3.1.7）：24H/3D/7D → hour；30D/全部 → day。
export function rangeBucket(v: RangeValue): "hour" | "day" {
  if (v.preset === "all" || v.preset === "30d") return "day";
  if (v.preset === "custom" && v.from && v.to) {
    const days =
      (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000;
    return days > 8 ? "day" : "hour";
  }
  return "hour";
}

export function rangeLabel(v: RangeValue): string {
  if (v.preset === "custom") return "自定义";
  return RANGE_PRESETS.find((p) => p.value === v.preset)?.label ?? "24H";
}
