import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";
import { ActivityIcon } from "lucide-react";
import { listRequests, type RequestListItem } from "@/lib/api/requests";
import { sortingToApiSort } from "@/lib/api/list-params";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useRefreshSettings } from "@/hooks/useRefreshSettings";
import { RangeFilter } from "@/components/common/RangeFilter";
import { RefreshControl } from "@/components/common/RefreshControl";
import {
  requestOsColumns,
  REQUEST_STATUS_OPTIONS,
} from "@/components/openstatus-table/requests-os-columns";
import { DataTable } from "@/components/tablecn/data-table";
import { DataTableSkeleton } from "@/components/tablecn/data-table-skeleton";
import { DataTableToolbar } from "@/components/tablecn/data-table-toolbar";
import { useDataTable } from "@/components/tablecn/hooks/use-data-table";
import { getSortingStateParser } from "@/components/tablecn/lib/parsers";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";

const PAGE_SIZE = 20;
const DEFAULT_SORT = [{ id: "created_at", desc: true }] as const;

/**
 * 时间筛选试验开关：
 * - false：用 tablecn `DataTableDateFilter`（日历区间）
 * - true：用原来的 `RangeFilter`（近24小时 + 最后刷新）
 * 旧组件与 useRangeQuery 均保留，随时可切回。
 */
const USE_LEGACY_RANGE_FILTER = true;

export interface RequestsListProps {
  /** 锁定用户：始终带 user_id 查询，隐藏用户筛选与用户/Key 列。 */
  fixedUserId?: number;
  /** 列布局 localStorage 键；嵌入页与请求中心分开存（tablecn 版暂用 URL 状态）。 */
  storageKey?: string;
  /** 外部时间区间（详情页与页头 RangeFilter 共用）；缺省则组件内自建区间。 */
  rangeParams?: { from?: string; to?: string };
  /** 是否在表格工具栏展示时间筛选；详情页由页头控制时应为 false。 */
  showRangeFilter?: boolean;
  /** 是否同步 URL 上的 request_id / q 深链打开详情（请求中心用）。 */
  syncUrlDeepLink?: boolean;
}

/** 请求记录列表：tablecn Data Table 试验版。 */
export function RequestsList({
  fixedUserId,
  storageKey = "requests",
  rangeParams: externalRangeParams,
  showRangeFilter = true,
  syncUrlDeepLink = false,
}: RequestsListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepRequestId = syncUrlDeepLink
    ? (searchParams.get("request_id") ?? searchParams.get("q"))
    : null;
  const closeDeep = () => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.delete("request_id");
        sp.delete("q");
        return sp;
      },
      { replace: true },
    );
  };

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );

  // —— 旧 RangeFilter 路径（USE_LEGACY_RANGE_FILTER=true 时启用）——
  const internalRange = useRangeQuery("24h");
  const useInternalLegacyRange =
    USE_LEGACY_RANGE_FILTER &&
    showRangeFilter &&
    externalRangeParams == null;

  const {
    autoRefresh,
    intervalSec,
    setAutoRefresh,
    setIntervalSec,
  } = useRefreshSettings(`${storageKey}:list`);

  // 与 useDataTable 共用 URL 键，驱动服务端查询。
  const [page] = useQueryState("page", parseAsInteger.withDefault(1));
  const [perPage] = useQueryState(
    "perPage",
    parseAsInteger.withDefault(PAGE_SIZE),
  );
  const [sorting] = useQueryState(
    "sort",
    getSortingStateParser<RequestListItem>().withDefault([...DEFAULT_SORT]),
  );
  const [statusFilter] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [modelFilter] = useQueryState("model", parseAsString.withDefault(""));
  const [userIdFilter] = useQueryState(
    "user_id",
    parseAsString.withDefault(""),
  );
  // tablecn 日期区间：created_at=[fromMs,toMs]
  const [createdAtFilter] = useQueryState(
    "created_at",
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  const status = statusFilter[0] ?? "";
  const model = modelFilter.trim();
  const parsedUserId = parsePositiveInt(userIdFilter);
  const userId = fixedUserId ?? parsedUserId;
  const sort = sortingToApiSort(sorting);

  const rangeParams = useMemo(() => {
    if (externalRangeParams) return externalRangeParams;
    if (USE_LEGACY_RANGE_FILTER) return internalRange.params;
    return timestampsToRangeParams(createdAtFilter);
  }, [createdAtFilter, externalRangeParams, internalRange.params]);

  const allColumns = useMemo(
    () => requestOsColumns(setSelectedRequestId),
    [],
  );
  const columns = useMemo(() => {
    let cols = allColumns;
    if (fixedUserId != null) {
      cols = cols.filter((col) => col.id !== "user_id");
    }
    // 外部已控时间 / 用旧 RangeFilter 时，关掉 tablecn 时间列筛选，避免重复
    if (externalRangeParams != null || USE_LEGACY_RANGE_FILTER || !showRangeFilter) {
      cols = cols.map((col) =>
        col.id === "created_at"
          ? { ...col, enableColumnFilter: false }
          : col,
      );
    }
    return cols;
  }, [allColumns, externalRangeParams, fixedUserId, showRangeFilter]);

  const query = useQuery({
    queryKey: [
      "requests",
      storageKey,
      "tablecn",
      { status, model, userId, page, perPage, sort, range: rangeParams },
    ],
    queryFn: () =>
      listRequests({
        page,
        pageSize: perPage,
        sort,
        status: status || undefined,
        model: model || undefined,
        userId,
        from: rangeParams.from,
        to: rangeParams.to,
      }),
    placeholderData: keepPreviousData,
  });

  const bumpRange = internalRange.refresh;
  const refetchList = query.refetch;

  // 手动 / 自动刷新：相对时间区间推进 to=now；否则仅 refetch 列表接口。
  const refreshList = useCallback(() => {
    if (useInternalLegacyRange) {
      bumpRange();
      return;
    }
    void refetchList();
  }, [bumpRange, refetchList, useInternalLegacyRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(refreshList, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [autoRefresh, intervalSec, refreshList]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const { table } = useDataTable({
    data: items,
    columns,
    pageCount,
    initialState: {
      sorting: [...DEFAULT_SORT],
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
      columnVisibility:
        fixedUserId != null ? { user_id: false } : undefined,
    },
    getRowId: (row) => String(row.id),
  });

  // URL 深链 status= 时，若 tablecn 尚未写入筛选，补一次（仅首屏）。
  useEffect(() => {
    if (!syncUrlDeepLink) return;
    const raw = searchParams.get("status");
    if (
      raw &&
      REQUEST_STATUS_OPTIONS.some((o) => o.value === raw) &&
      statusFilter.length === 0
    ) {
      void table.getColumn("status")?.setFilterValue([raw]);
    }
    // 仅挂载时处理深链
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {deepRequestId ? (
        <RequestDetailDialog
          requestId={deepRequestId}
          open
          onOpenChange={(o) => {
            if (!o) closeDeep();
          }}
        />
      ) : null}
      {selectedRequestId ? (
        <RequestDetailDialog
          requestId={selectedRequestId}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedRequestId(null);
          }}
        />
      ) : null}

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : query.isPending && items.length === 0 ? (
        <DataTableSkeleton columnCount={columns.length} rowCount={8} />
      ) : (
        <DataTable
          table={table}
          emptyMessage={<RequestsEmpty />}
          onRowClick={(row) => setSelectedRequestId(row.request_id)}
        >
          <DataTableToolbar
            table={table}
            leading={
              useInternalLegacyRange ? (
                <RangeFilter
                  value={internalRange.value}
                  onChange={(v) => {
                    internalRange.setRange(v);
                    void table.setPageIndex(0);
                  }}
                  showRefresh={false}
                />
              ) : null
            }
          >
            <RefreshControl
              autoRefresh={autoRefresh}
              intervalSec={intervalSec}
              onAutoRefreshChange={setAutoRefresh}
              onIntervalChange={setIntervalSec}
              onRefresh={refreshList}
              spinning={autoRefresh || query.isFetching}
            />
          </DataTableToolbar>
        </DataTable>
      )}
    </div>
  );
}

function RequestsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyTitle>暂无请求</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的请求记录。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** tablecn 日期筛选时间戳 → 列表 API 的 from/to（ISO）。 */
function timestampsToRangeParams(values: string[]): {
  from?: string;
  to?: string;
} {
  const fromMs = values[0] != null && values[0] !== "" ? Number(values[0]) : NaN;
  const toMs = values[1] != null && values[1] !== "" ? Number(values[1]) : NaN;
  // 日历选日是当天 0 点；结束日取当天末，避免漏掉当天记录
  let toIso: string | undefined;
  if (Number.isFinite(toMs)) {
    const end = new Date(toMs);
    end.setHours(23, 59, 59, 999);
    toIso = end.toISOString();
  }
  return {
    from: Number.isFinite(fromMs) ? new Date(fromMs).toISOString() : undefined,
    to: toIso,
  };
}
