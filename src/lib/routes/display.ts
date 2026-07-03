export const ROUTE_MODE_LABEL: Record<string, string> = {
  cheapest: "经济",
  stable: "稳定",
  fixed: "固定",
};

/** 候选池类型展示（与 ADMIN-IA §3.5 口径一致）。 */
export function routePoolKindLabel(poolKind: string, mode: string): string {
  if (poolKind === "all") return "全量动态";
  if (mode === "fixed") return "固定单渠道";
  return "手挑渠道";
}
