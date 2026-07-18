import { useCallback, useMemo, useState } from "react";
import type { SortingState, Updater } from "@tanstack/react-table";
import { parseAsInteger, type UseQueryStateOptions, useQueryState } from "nuqs";
import {
  apiSortToSorting,
  sortingToApiSort,
  type ServerListParams,
} from "@/lib/api/list-params";
import { getSortingStateParser } from "@/components/tablecn/lib/parsers";
import { deriveTableUrlKeys, sanitizeTableUrlNamespace } from "@/lib/table-url-keys";

const DEFAULT_PAGE_SIZE = 20;

const QUERY_STATE_OPTIONS: Omit<UseQueryStateOptions<string>, "parse"> = {
  history: "replace",
  shallow: true,
};

export interface UseServerListOptions<F extends Record<string, unknown>> {
  pageSize?: number;
  /** 默认排序 API 字段（不含 +/- 前缀） */
  defaultSort?: { id: string; desc: boolean };
  initialFilters?: F;
  /**
   * URL 命名空间（如 storageKey / queryKey）；缺省则用全局 page / sort。
   * 传入时会自动 sanitize（`:`、`/` → `-`）。
   */
  urlKey?: string;
  /** 排序列 id，用于 URL sort 解析校验 */
  sortColumnIds?: string[] | Set<string>;
}

/**
 * 服务端列表状态：page / page_size / sort / 筛选字段。
 * page / sort 同步 URL（nuqs）；排序或筛选变更时重置到第 1 页。
 */
export function useServerList<F extends Record<string, unknown> = Record<string, never>>({
  pageSize = DEFAULT_PAGE_SIZE,
  defaultSort,
  initialFilters,
  urlKey,
  sortColumnIds,
}: UseServerListOptions<F> = {}) {
  const namespace = urlKey ? sanitizeTableUrlNamespace(urlKey) : undefined;
  const keys = deriveTableUrlKeys(namespace);

  const defaultSorting = useMemo((): SortingState => {
    return defaultSort ? [{ id: defaultSort.id, desc: defaultSort.desc }] : [];
  }, [defaultSort]);

  const [page, setPageRaw] = useQueryState(
    keys.page,
    parseAsInteger.withOptions(QUERY_STATE_OPTIONS).withDefault(1),
  );

  const [sorting, setSortingRaw] = useQueryState(
    keys.sort,
    getSortingStateParser(sortColumnIds)
      .withOptions(QUERY_STATE_OPTIONS)
      .withDefault(defaultSorting),
  );

  const [filters, setFiltersState] = useState<F>((initialFilters ?? {}) as F);

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      void setPageRaw((prev) => {
        const value = typeof next === "function" ? next(prev ?? 1) : next;
        return Math.max(1, value);
      });
    },
    [setPageRaw],
  );

  const setSortingState = useCallback(
    (next: SortingState) => {
      void setSortingRaw(next.length > 0 ? next : null);
      void setPageRaw(1);
    },
    [setPageRaw, setSortingRaw],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSortingState(next);
    },
    [setSortingState, sorting],
  );

  const sort = useMemo(() => sortingToApiSort(sorting), [sorting]);

  const patchFilters = useCallback((patch: Partial<F>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    void setPageRaw(1);
  }, [setPageRaw]);

  const resetFilters = useCallback(() => {
    setFiltersState((initialFilters ?? {}) as F);
    void setPageRaw(1);
  }, [initialFilters, setPageRaw]);

  const queryParams = useMemo((): ServerListParams & F => {
    return {
      page,
      page_size: pageSize,
      ...(sort ? { sort } : {}),
      ...filters,
    } as ServerListParams & F;
  }, [page, pageSize, sort, filters]);

  const resetAll = useCallback(() => {
    void setSortingRaw(defaultSorting.length > 0 ? defaultSorting : null);
    setFiltersState((initialFilters ?? {}) as F);
    void setPageRaw(1);
  }, [defaultSorting, initialFilters, setPageRaw, setSortingRaw]);

  return {
    page,
    setPage,
    pageSize,
    sorting,
    setSorting: onSortingChange,
    sort,
    filters,
    setFilters: patchFilters,
    resetFilters,
    resetAll,
    queryParams,
    urlKeys: keys,
    /** 从 URL 深链恢复 sort（可选） */
    setSortFromApi: (apiSort?: string) => setSortingState(apiSortToSorting(apiSort)),
  };
}
