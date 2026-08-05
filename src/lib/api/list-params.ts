/** Admin 列表 REST 查询参数（与后端 snake_case wire 对齐）。 */

import type { Page } from "@/lib/api/types";

/** 服务端列表请求基类。sort 前缀 `-` 表示降序。 */
export interface ServerListParams {
  page: number;
  page_size: number;
  sort?: string;
}

/** 把 sort 状态编码为 ?sort=field 或 ?sort=-field */
function encodeSort(field: string, desc: boolean): string {
  return desc ? `-${field}` : field;
}

/** 解析 TanStack sorting state 的第一列 → API sort 字符串 */
export function sortingToApiSort(
  sorting: { id: string; desc: boolean }[],
): string | undefined {
  const first = sorting[0];
  if (!first) return undefined;
  return encodeSort(first.id, first.desc);
}

/** 把 API sort 字符串解析为 TanStack sorting state */
export function apiSortToSorting(
  sort: string | undefined,
): { id: string; desc: boolean }[] {
  if (!sort) return [];
  const desc = sort.startsWith("-");
  const id = desc ? sort.slice(1) : sort.startsWith("+") ? sort.slice(1) : sort;
  return id ? [{ id, desc }] : [];
}

/** 构建 query params 对象（省略 undefined/空值） */
export function buildListQuery(
  params: object,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

const ALL_PAGE_SIZE = 100;

/** 循环读取分页接口，直到收齐服务端报告的全部结果。 */
export async function collectAllPages<T>(
  loadPage: (page: number, pageSize: number) => Promise<Page<T>>,
  pageSize = ALL_PAGE_SIZE,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await loadPage(page, pageSize);
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) {
      return items;
    }
  }
}
