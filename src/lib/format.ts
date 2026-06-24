// 价格/时间相关的纯展示与转换工具，成本价与售价弹窗共用。

// 去掉十进制字符串的多余尾零："0.2700000000" → "0.27"，"1.0000000000" → "1"。
export function trimDecimal(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

// datetime-local 值（本地时区，无时区信息）→ RFC3339（UTC）。
export function localToRFC3339(local: string): string {
  return new Date(local).toISOString();
}

// RFC3339 → datetime-local 值（按本地时区，截到分钟）。
export function rfc3339ToLocal(rfc: string | null): string {
  if (!rfc) return "";
  const d = new Date(rfc);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

// RFC3339 → 本地可读时间串。
export function formatDateTime(rfc: string): string {
  return new Date(rfc).toLocaleString();
}

// ---- 运维控制台共用展示格式（§3.1.4 数值格式；金额一律 USD）----

const DASH = "—";

// 整数千分位。空值 → 「—」。
export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH;
  return new Intl.NumberFormat("en-US").format(n);
}

// 紧凑计数：1.2K / 3.4M。
export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH;
  if (n < 1000) return String(n);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

// 比例 [0,1] → 百分比文案。
export function formatPercent(
  ratio: number | null | undefined,
  digits = 1,
): string {
  if (ratio == null || Number.isNaN(ratio)) return DASH;
  return `${(ratio * 100).toFixed(digits)}%`;
}

// 毫秒延迟：<1s 用 ms，≥1s 用 s。
export function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// 输出 token 速率。
export function formatTPS(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return DASH;
  return `${v.toFixed(1)} t/s`;
}

// 金额：USD，2 位小数。入参可为后端十进制字符串。
export function formatUSD(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return DASH;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return DASH;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// 相对时间：x 秒/分钟/小时/天前；超 30 天回退绝对日期。
export function formatRelativeTime(rfc: string | null | undefined): string {
  if (!rfc) return DASH;
  const then = new Date(rfc).getTime();
  if (Number.isNaN(then)) return DASH;
  const diff = Date.now() - then;
  if (diff < 0) return formatDateTime(rfc);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} 秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(rfc).toLocaleDateString();
}

// 时分秒，用于「最后刷新」。
export function formatClock(d: number | Date): string {
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
