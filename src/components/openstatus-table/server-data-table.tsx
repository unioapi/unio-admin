import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
import { getColumnPinningStyle } from "@/components/tablecn/lib/data-table";

export interface ServerDataTableProps<TData> {
  storageKey: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  columnLabels: Record<string, string>;
  /** 服务端总数 / 当前页 / 总页数（受控）。 */
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** 每页条数，用于底栏文案；默认 20。 */
  pageSize?: number;
  /** 服务端排序（受控）。 */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  getRowId?: (row: TData, index: number) => string;
  loading?: boolean;
  refetching?: boolean;
  emptyContent?: ReactNode;
  emptyMessage?: string;
  toolbarLeading?: ReactNode;
  toolbarFilters?: ReactNode;
  toolbarActions?: ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** 列显隐 View；主列表默认 true，详情嵌套表传 false */
  showViewOptions?: boolean;
  /** @deprecated tablecn 版不使用列拖拽；保留 API 兼容 */
  pinnedColumnId?: string | null;
  /** @deprecated tablecn 版不使用弹性列宽 */
  columnFlexMode?: "proportional" | "equal" | "content";
  /** @deprecated tablecn 版不使用内容宽度估算 */
  getAutoSizeValue?: (row: TData, columnId: string) => unknown;
  onRowClick?: (row: TData) => void;
  /** 表格外框圆角边框；详情内嵌表可传 false */
  bordered?: boolean;
}

export function ServerDataTable<TData>({
  columns: columnsProp,
  data,
  columnLabels,
  page,
  pageCount,
  onPageChange,
  pageSize = 20,
  sorting = [],
  onSortingChange,
  getRowId,
  loading = false,
  refetching = false,
  emptyContent,
  emptyMessage = "暂无数据",
  toolbarLeading,
  toolbarFilters,
  toolbarActions,
  searchValue,
  onSearchChange,
  searchPlaceholder = "搜索",
  showViewOptions = true,
  onRowClick,
  bordered = true,
}: ServerDataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo(
    () =>
      columnsProp.map((col) => {
        const id = col.id ?? (col as { accessorKey?: string }).accessorKey ?? "";
        const label = columnLabels[id] ?? col.meta?.label ?? id;
        return {
          ...col,
          id: id || undefined,
          meta: { ...col.meta, label },
        };
      }),
    [columnLabels, columnsProp],
  );

  const safePage = Math.min(Math.max(1, page), Math.max(1, pageCount));
  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [onPageChange, page, safePage]);

  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: safePage - 1, pageSize }),
    [safePage, pageSize],
  );

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      onPageChange(next.pageIndex + 1);
    },
    [onPageChange, pagination],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility, sorting, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      if (!onSortingChange) return;
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualSorting: Boolean(onSortingChange),
    pageCount,
    enableColumnFilters: false,
  });

  const showToolbar =
    Boolean(toolbarLeading) ||
    Boolean(toolbarFilters) ||
    Boolean(onSearchChange) ||
    Boolean(toolbarActions) ||
    showViewOptions;

  // 布局对齐请求中心 DataTableToolbar：筛选/搜索在左，操作与 View 在右
  const toolbar = showToolbar ? (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className="flex w-full items-start justify-between gap-2 p-1"
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {toolbarLeading}
        {toolbarFilters}
        {onSearchChange ? (
          <Input
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-40 lg:w-56"
          />
        ) : null}
      </div>
      {toolbarActions || showViewOptions ? (
        <div className="flex items-center gap-2">
          {toolbarActions}
          {showViewOptions ? (
            <DataTableViewOptions table={table} align="end" />
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {toolbar}
        <DataTableSkeleton columnCount={columns.length} rowCount={8} />
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  const showEmpty = rows.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      {toolbar}

      <div
        className={cn(
          "flex w-full flex-col gap-2.5 overflow-auto",
          refetching && "opacity-60",
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
              {showEmpty ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {emptyContent ?? emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
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
              )}
            </TableBody>
          </Table>
        </div>

        {!showEmpty ? (
          <DataTablePagination table={table} pageSizeOptions={[pageSize]} />
        ) : null}
      </div>
    </div>
  );
}
