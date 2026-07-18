import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import type { Page } from "@/lib/api/types";
import { namespaceFromQueryKey } from "@/lib/table-url-keys";

const PAGE_SIZE = 20;

/** URL 里表示「不限状态」；勿用 null + withDefault，否则清除后会弹回 initialStatus。 */
const STATUS_ALL = "all";

const QUERY_STATE_OPTIONS = {
  history: "replace" as const,
  shallow: true,
};

interface StatusOption {
  value: string;
  label: string;
}

/** 传给 fetch 的服务端列表参数；range/userId 等固定参数由调用方在 fetch 闭包里合并。 */
interface ServerTableFetchParams {
  page: number;
  page_size: number;
  sort?: string;
  status?: string;
  search?: string;
}

interface UseServerTableOptions<T> {
  /**
   * react-query key 前缀（实体名，如 "channels" / "users" / "api-keys"）。
   * 列表键统一组成 [queryKey, ...extraKey, "ops-list", ...]，使写操作
   * invalidateQueries({queryKey:[queryKey, ...extraKey?]}) 能前缀命中本列表并自动刷新。
   */
  queryKey: string;
  fetch: (params: ServerTableFetchParams) => Promise<Page<T>>;
  defaultSort?: { id: string; desc: boolean };
  /** 提供后暴露 status / onStatusChange / statusOptions。 */
  statusOptions?: readonly StatusOption[];
  /** 状态过滤初值：缺省 ""（显示全部）；传 "enabled" 可默认只显示启用。 */
  initialStatus?: string;
  /** 额外 query key 片段（如 userId、range），排在实体名之后以保证前缀失效可命中。 */
  extraKey?: readonly unknown[];
  enabled?: boolean;
  pageSize?: number;
  /** 传给 useQuery 的 refetchInterval（毫秒）；用于熔断倒计时等需周期性刷新的列表。 */
  refetchInterval?: number | false;
  /** URL 命名空间；缺省为 sanitize(queryKey + extraKey)。 */
  urlKey?: string;
}

function statusFromUrl(raw: string | null, initialStatus: string): string {
  if (raw === null) return initialStatus;
  if (raw === STATUS_ALL || raw === "") return "";
  return raw;
}

/** 服务端聚合列表通用 hook：分页 / 排序 / 可选 status / search，状态同步 URL。 */
export function useServerTable<T>({
  queryKey,
  fetch,
  defaultSort,
  statusOptions,
  initialStatus = "",
  extraKey = [],
  enabled = true,
  pageSize = PAGE_SIZE,
  refetchInterval,
  urlKey,
}: UseServerTableOptions<T>) {
  const namespace = urlKey ?? namespaceFromQueryKey(queryKey, extraKey);

  const { page, setPage, sorting, setSorting, sort, urlKeys } = useServerList({
    pageSize,
    defaultSort,
    urlKey: namespace,
  });

  const [searchFromUrl, setSearchUrl] = useQueryState(
    urlKeys.q,
    parseAsString.withOptions(QUERY_STATE_OPTIONS).withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  // 不用 withDefault(initialStatus)：set(null) 会回落默认，状态筛选的 × 等于失灵。
  // null = 尚未写入 URL → 用 initialStatus；明确写入 STATUS_ALL 表示「全部」。
  const [statusParam, setStatusRaw] = useQueryState(
    urlKeys.status,
    parseAsString.withOptions(QUERY_STATE_OPTIONS),
  );
  const status = statusFromUrl(statusParam, initialStatus);

  // 首屏把默认状态落到 URL，避免「看起来已筛选、URL 却是空」导致清除语义混乱。
  useEffect(() => {
    if (statusParam === null && initialStatus) {
      void setStatusRaw(initialStatus);
    }
  }, [initialStatus, setStatusRaw, statusParam]);

  const search = useDebouncedValue(searchInput.trim(), 300);

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    const next = search || null;
    if ((searchFromUrl || "") !== (search || "")) {
      void setSearchUrl(next);
    }
  }, [search, searchFromUrl, setSearchUrl]);

  const query = useQuery({
    queryKey: [queryKey, ...extraKey, "ops-list", page, sort, status, search],
    queryFn: () =>
      fetch({
        page,
        page_size: pageSize,
        sort,
        status: status || undefined,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const onStatusChange = useCallback(
    (v: string) => {
      // 明确写入 all，避免 null 被当成「未设置」又套回 initialStatus
      void setStatusRaw(v ? v : STATUS_ALL);
      setPage(1);
    },
    [setPage, setStatusRaw],
  );

  const onSearchChange = useCallback(
    (v: string) => {
      setSearchInput(v);
      setPage(1);
    },
    [setPage],
  );

  return {
    items: query.data?.items ?? [],
    total,
    page,
    pageCount,
    setPage,
    sorting,
    setSorting,
    status,
    onStatusChange,
    statusOptions: statusOptions ?? [],
    searchInput,
    onSearchChange,
    query,
    urlKeys,
  };
}
