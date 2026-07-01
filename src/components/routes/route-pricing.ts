import { roundPrice3, trimDecimal } from "@/lib/format";

export function parseRouteRatio(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return 1;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 倍率输入展示：去掉 DB/API 十进制尾零，保留最多 3 位小数。 */
export function formatRouteRatioInput(raw: string | null | undefined): string {
  if (raw == null || raw.trim() === "") return "1";
  const s = raw.trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  const rounded = roundPrice3(n);
  return rounded === "" ? s : trimDecimal(rounded);
}

export function applyRouteRatio(base: string | null | undefined, ratio: number): number | null {
  if (base == null) return null;
  const baseN = Number(base);
  if (!Number.isFinite(baseN)) return null;
  return Number(roundPrice3(baseN * ratio));
}

export type MarginTone = "up" | "down" | "flat" | "na";

export function marginTone(delta: number | null): MarginTone {
  if (delta == null) return "na";
  if (Math.abs(delta) < 0.0005) return "flat";
  return delta > 0 ? "up" : "down";
}

/** 线路试算金额展示：四舍五入至 3 位小数。 */
export function formatRoutePrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const s = roundPrice3(n);
  return s === "" ? "—" : trimDecimal(s);
}

/** 线路试算差异展示：带符号，3 位小数。 */
export function formatRouteDelta(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 0.0005) return "0";
  const sign = n > 0 ? "+" : "";
  const s = roundPrice3(n);
  return s === "" ? "—" : `${sign}${trimDecimal(s)}`;
}
