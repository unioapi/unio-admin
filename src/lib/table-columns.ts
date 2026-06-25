/** 表格列对齐（当前产品统一左对齐）。 */
export type TableColumnAlign = "left" | "right" | "center";

/** 表头/单元格对齐 class；当前固定左对齐。 */
export function tableAlignClass(_align: TableColumnAlign = "left") {
  return "text-left";
}

/** table-fixed 列宽 token（固定 px）；抽屉/窄表适用 */
export const col = {
  primary: "w-56 min-w-0",
  primarySm: "w-48 min-w-0",
  primaryLg: "w-72 min-w-0",
  id: "w-14",
  idMd: "w-16",
  status: "w-20",
  badge: "w-24",
  badgeLg: "w-28",
  num: "w-24",
  numSm: "w-20",
  money: "w-32",
  percent: "w-24",
  latency: "w-28",
  time: "w-28",
  datetime: "w-44",
  action: "w-16",
  actionLg: "w-24",
  text: "w-32",
  textMd: "w-36",
  textLg: "w-40",
  textXl: "w-48",
  mono: "w-52",
  route: "w-36",
  error: "w-40",
  bool: "w-16",
  bar: "w-[40%]",
  pair: "w-32",
  price: "w-32",
  vendor: "w-28",
} as const;

/** 全宽运维表：百分比列宽，合计 100%，宽屏下均匀分布 */
export const colPct = {
  primary: "w-[26%]",
  primaryMd: "w-[22%]",
  primaryLg: "w-[28%]",
  primarySm: "w-[18%]",
  money: "w-[10%]",
  num: "w-[9%]",
  numSm: "w-[7%]",
  numLg: "w-[11%]",
  badge: "w-[9%]",
  badgeLg: "w-[11%]",
  percent: "w-[10%]",
  latency: "w-[11%]",
  time: "w-[11%]",
  timeSm: "w-[9%]",
  timeLg: "w-[16%]",
  text: "w-[12%]",
  textSm: "w-[10%]",
  textMd: "w-[14%]",
  error: "w-[14%]",
  action: "w-[8%]",
  actionSm: "w-[7%]",
} as const;
