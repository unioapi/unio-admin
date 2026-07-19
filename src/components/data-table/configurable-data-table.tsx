import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableSkeleton } from "@/components/tablecn/data-table-skeleton";
import { DataTablePagination } from "@/components/tablecn/data-table-pagination";
import { DataTableViewOptions } from "@/components/tablecn/data-table-view-options";
import { getSortingStateParser } from "@/components/tablecn/lib/parsers";
import { getColumnPinningStyle } from "@/components/tablecn/lib/data-table";
import {
  deriveTableUrlKeys,
  sanitizeTableUrlNamespace,
} from "@/lib/table-url-keys";
import type { TableLayoutPrefs } from "./use-persisted-table-state";

const DEFAULT_PAGE_SIZE = 20;

const QUERY_STATE_OPTIONS = {
  history: "replace" as const,
  shallow: true,
};

export type ConfigurableDataTableProps<TData> = {
  /** localStorage / URL 命名空间键，如 `providers:ops-table` */
  storageKey: string;
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  columnLabels?: Record<string, string>;
  /** @deprecated tablecn 版不支持列固定 */
  pinnedColumnId?: string | null;
  /** @deprecated tablecn 版不使用弹性列宽 */
  columnFlexMode?: "proportional" | "equal" | "content";
  /** @deprecated 保留 API；列可见性由 View 选项控制 */
  defaultLayout?: TableLayoutPrefs;
  /** @deprecated 保留 API */
  layoutMode?: "fixed" | "content";
  /** @deprecated 保留 API */
  getAutoSizeValue?: (row: TData, columnId: string) => unknown;
  /** @deprecated 保留 API */
  sanitizeLayout?: (prefs: TableLayoutPrefs) => TableLayoutPrefs;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  emptyMessage?: string;
  emptyContent?: ReactNode;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  loading?: boolean;
  loadingRows?: number;
  /** 外层圆角边框；默认 true */
  bordered?: boolean;
  /** 表格容器额外 class（如 refetch 时 opacity-60） */
  tableClassName?: string;
  className?: string;
  /** 每页条数；默认 20 */
  pageSize?: number;
  /**
   * 是否启用分页；默认 false。
   * 详情/仪表盘嵌套表一次展全；主列表若需分页再显式打开。
   */
  enablePagination?: boolean;
  /** 是否显示列显隐 View；默认 false（嵌套表不需要） */
  showViewOptions?: boolean;
};

function columnIdOf<TData>(col: ColumnDef<TData, unknown>): string {
  return (
    col.id ??
    ((col as { accessorKey?: string }).accessorKey as string | undefined) ??
    ""
  );
}

function columnLabelsFromDefs<TData>(
  columns: ColumnDef<TData, unknown>[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const id = columnIdOf(col);
    if (id) out[id] = col.meta?.label ?? id;
  }
  return out;
}

/**
 * 客户端数据表：分页 / 排序同步 URL（tablecn 风格）。
 */
export function ConfigurableDataTable<TData>({
  storageKey,
  data,
  columns: columnsProp,
  columnLabels: columnLabelsProp,
  toolbarStart,
  toolbarEnd,
  emptyMessage = "暂无数据",
  emptyContent,
  getRowId,
  onRowClick,
  loading = false,
  loadingRows = 6,
  bordered = true,
  tableClassName,
  className,
  pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
  enablePagination = false,
  showViewOptions = false,
}: ConfigurableDataTableProps<TData>) {
  const namespace = sanitizeTableUrlNamespace(storageKey);
  const keys = deriveTableUrlKeys(namespace);

  const columnLabels = useMemo(
    () => columnLabelsProp ?? columnLabelsFromDefs(columnsProp),
    [columnLabelsProp, columnsProp],
  );

  const columns = useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      columnsProp.map((col): ColumnDef<TData, unknown> => {
        const id = columnIdOf(col);
        const label = columnLabels[id] ?? col.meta?.label ?? id;
        return {
          ...col,
          id: id || col.id,
          meta: { ...col.meta, label },
        } as ColumnDef<TData, unknown>;
      }),
    [columnLabels, columnsProp],
  );

  // Stable string key so nuqs parser identity doesn't thrash on Set recreation.
  const columnIdsKey = useMemo(
    () =>
      columns
        .map((c) => c.id)
        .filter(Boolean)
        .join("\0"),
    [columns],
  );
  const columnIds = useMemo(
    () => new Set(columnIdsKey ? columnIdsKey.split("\0") : []),
    [columnIdsKey],
  );

  const [page, setPage] = useQueryState(
    keys.page,
    parseAsInteger.withOptions(QUERY_STATE_OPTIONS).withDefault(1),
  );
  const [perPage, setPerPage] = useQueryState(
    keys.perPage,
    parseAsInteger.withOptions(QUERY_STATE_OPTIONS).withDefault(pageSizeProp),
  );
  const [sorting, setSortingRaw] = useQueryState(
    keys.sort,
    getSortingStateParser(columnIds)
      .withOptions(QUERY_STATE_OPTIONS)
      .withDefault([]),
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const pageSize = enablePagination
    ? Math.max(1, perPage || pageSizeProp || DEFAULT_PAGE_SIZE)
    : Math.max(data.length, 1);
  const pageCount = Math.max(1, Math.ceil(Math.max(data.length, 1) / pageSize));
  // Clamp before render — OOB pageIndex makes getPaginationRowModel return 0 rows.
  const safePage = Math.min(Math.max(1, page || 1), pageCount);

  useEffect(() => {
    if (enablePagination && page !== safePage) void setPage(safePage);
  }, [enablePagination, page, safePage, setPage]);

  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: safePage - 1, pageSize }),
    [safePage, pageSize],
  );

  const sortingState: SortingState = useMemo(() => sorting ?? [], [sorting]);

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      if (!enablePagination) return;
      const next = typeof updater === "function" ? updater(pagination) : updater;
      void setPage(next.pageIndex + 1);
      void setPerPage(Math.max(1, next.pageSize));
    },
    [enablePagination, pagination, setPage, setPerPage],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next =
        typeof updater === "function" ? updater(sortingState) : updater;
      void setSortingRaw(next.length > 0 ? next : null);
      if (enablePagination) void setPage(1);
    },
    [enablePagination, setPage, setSortingRaw, sortingState],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility, sorting: sortingState, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    autoResetPageIndex: false,
  });

  const showToolbar =
    Boolean(toolbarStart) || Boolean(toolbarEnd) || showViewOptions;
  const toolbar = showToolbar ? (
    <div className="mb-1 flex flex-wrap items-center gap-2 p-1">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {toolbarStart}
      </div>
      {toolbarEnd || showViewOptions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {toolbarEnd}
          {showViewOptions ? (
            <DataTableViewOptions table={table} align="end" />
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={className}>
        {toolbar}
        <DataTableSkeleton columnCount={columns.length} rowCount={loadingRows} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {toolbar}
        {emptyContent ?? (
          <p className="text-muted-foreground py-10 text-left text-sm">{emptyMessage}</p>
        )}
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <div className={className}>
      {toolbar}
      <div
        className={cn(
          "flex w-full flex-col gap-2.5 overflow-auto",
          tableClassName,
        )}
      >
        <div
          className={cn(
            "overflow-hidden rounded-md",
            bordered && "border",
          )}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getColumnPinningStyle({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-accent/50",
                    )}
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          ...getColumnPinningStyle({ column: cell.column }),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {enablePagination && pageCount > 1 ? (
          <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
        ) : null}
      </div>
    </div>
  );
}
