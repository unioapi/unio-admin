import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import type { FilterChip } from "@/components/openstatus-table";
import type { Page } from "@/lib/api/types";

const PAGE_SIZE = 20;

/** 启停状态过滤选项（服务商/渠道/模型/线路列表通用）。 */
export const ENTITY_STATUS_OPTIONS = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
] as const;

export interface StatusOption {
  value: string;
  label: string;
}

/** 传给 fetch 的服务端列表参数；range/userId 等固定参数由调用方在 fetch 闭包里合并。 */
export interface ServerTableFetchParams {
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
  /** 提供后暴露 status / onStatusChange / statusOptions 与状态 chip。 */
  statusOptions?: readonly StatusOption[];
  /** 状态过滤初值：缺省 ""（显示全部）；传 "enabled" 可默认只显示启用（归档/停用需手动切换）。 */
  initialStatus?: string;
  /** 额外 query key 片段（如 userId、range），排在实体名之后以保证前缀失效可命中。 */
  extraKey?: readonly unknown[];
  enabled?: boolean;
  pageSize?: number;
  /** 搜索 chip 文案前缀，默认「搜索」。 */
  searchChipLabel?: string;
}

/** 服务端聚合列表通用 hook：分页 / 排序 / 可选 status / search（含 chips）。 */
export function useServerTable<T>({
  queryKey,
  fetch,
  defaultSort,
  statusOptions,
  initialStatus = "",
  extraKey = [],
  enabled = true,
  pageSize = PAGE_SIZE,
  searchChipLabel = "搜索",
}: UseServerTableOptions<T>) {
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    pageSize,
    defaultSort,
  });

  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const search = useDebouncedValue(searchInput.trim(), 300);

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
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = [];
    if (status && statusOptions) {
      const label = statusOptions.find((o) => o.value === status)?.label ?? status;
      out.push({
        id: `status:${status}`,
        label: `状态 · ${label}`,
        onRemove: () => {
          setStatus("");
          setPage(1);
        },
      });
    }
    if (search) {
      out.push({
        id: "search",
        label: `${searchChipLabel} · ${search}`,
        onRemove: () => {
          setSearchInput("");
          setPage(1);
        },
      });
    }
    return out;
  }, [status, statusOptions, search, searchChipLabel, setPage]);

  return {
    items: query.data?.items ?? [],
    total,
    page,
    pageCount,
    setPage,
    sorting,
    setSorting,
    status,
    onStatusChange: (v: string) => {
      setStatus(v);
      setPage(1);
    },
    statusOptions: statusOptions ?? [],
    searchInput,
    onSearchChange: (v: string) => {
      setSearchInput(v);
      setPage(1);
    },
    chips,
    resetFilters: () => {
      setStatus("");
      setSearchInput("");
      setPage(1);
    },
    query,
  };
}
