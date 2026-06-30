import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import type { FilterChip } from "@/components/openstatus-table";
import type { Page } from "@/lib/api/types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
] as const;

interface UseOpsServerTableOptions<T> {
  // queryKey 为实体前缀（如 "providers" / "channels" / "models" / "routes"）。
  // 列表查询键统一组成 [entity, "ops-list", ...]，使各实体写操作 invalidateQueries({queryKey:[entity]})
  // 能前缀命中本列表并自动刷新（修复「创建后需手动刷新」）。
  queryKey: string;
  fetch: (params: {
    range: "all";
    page: number;
    page_size: number;
    sort?: string;
    status?: string;
    search?: string;
  }) => Promise<Page<T>>;
  /** 缺省不传则列表无默认排序 */
  defaultSort?: { id: string; desc: boolean };
}

/** 运维聚合表通用服务端列表：分页 / 排序 / status / search。 */
export function useOpsServerTable<T>({
  queryKey,
  fetch,
  defaultSort,
}: UseOpsServerTableOptions<T>) {
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    pageSize: PAGE_SIZE,
    defaultSort,
  });

  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);

  const query = useQuery({
    queryKey: [queryKey, "ops-list", page, sort, status, search],
    queryFn: () =>
      fetch({
        range: "all",
        page,
        page_size: PAGE_SIZE,
        sort,
        status: status || undefined,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = [];
    if (status) {
      const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
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
        label: `搜索 · ${search}`,
        onRemove: () => {
          setSearchInput("");
          setPage(1);
        },
      });
    }
    return out;
  }, [status, search, setPage]);

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
    statusOptions: STATUS_OPTIONS,
  };
}
