import { useCallback, useMemo, type ReactNode } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTable,
  DataTableViewOptions,
  clampColumnSizing,
  computeContentMinWidths,
  defaultTableLayout,
  ensureResizableColumns,
  pinnedColumnIdFromDefs,
  usePersistedTableState,
  type ColumnFlexMode,
} from "@/components/data-table";
import { FilterChips, type FilterChip } from "./filter-chips";
import { TablePagination } from "@/components/common/TablePagination";

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
  chips?: FilterChip[];
  onClearChips?: () => void;
  /** 不参与拖拽的列 id；默认从列定义推断 */
  pinnedColumnId?: string | null;
  /** proportional：按 minSize 比例；equal：各列等分容器宽度（默认） */
  columnFlexMode?: ColumnFlexMode;
  /** 覆盖单列内容宽度估算 */
  getAutoSizeValue?: (row: TData, columnId: string) => unknown;
  onRowClick?: (row: TData) => void;
  /** 表格外框圆角边框；详情内嵌表可传 false */
  bordered?: boolean;
}

export function ServerDataTable<TData>({
  storageKey,
  columns: columnsProp,
  data,
  columnLabels,
  total,
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
  chips = [],
  onClearChips,
  pinnedColumnId: pinnedColumnIdProp,
  columnFlexMode = "equal",
  getAutoSizeValue,
  onRowClick,
  bordered = true,
}: ServerDataTableProps<TData>) {
  const columns = useMemo(
    () => ensureResizableColumns(columnsProp),
    [columnsProp],
  );

  const pinnedColumnId =
    pinnedColumnIdProp !== undefined
      ? pinnedColumnIdProp
      : pinnedColumnIdFromDefs(columns);

  const defaultLayout = useMemo(() => defaultTableLayout(columns), [columns]);

  const sanitizePrefs = useCallback(
    (prefs: ReturnType<typeof defaultTableLayout>) => ({
      ...prefs,
      columnSizing: clampColumnSizing(
        prefs.columnSizing,
        columns as ColumnDef<unknown, unknown>[],
      ),
    }),
    [columns],
  );

  const {
    columnOrder,
    columnVisibility,
    columnSizing,
    setColumnOrder,
    setColumnVisibility,
    setColumnSizing,
    resetLayout,
  } = usePersistedTableState(storageKey, defaultLayout, sanitizePrefs);

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility, sorting, columnOrder, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: (updater) => {
      if (!onSortingChange) return;
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount,
    enableColumnFilters: false,
    enableColumnResizing: false,
  });

  const labels = useMemo(() => columnLabels, [columnLabels]);
  const contentMinWidths = useMemo(
    () => computeContentMinWidths(columns, data, labels, getAutoSizeValue),
    [columns, data, getAutoSizeValue, labels],
  );
  const rows = table.getRowModel().rows;
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {toolbarLeading ? (
          <div className="flex shrink-0 items-center gap-2">{toolbarLeading}</div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {toolbarFilters}

          {onSearchChange ? (
            <div className="relative w-52">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8"
              />
            </div>
          ) : null}

          {toolbarActions}
          <DataTableViewOptions
            table={table}
            labels={labels}
            onReset={() => {
              onSortingChange?.([]);
              resetLayout();
            }}
          />
        </div>
      </div>

      {chips.length > 0 ? (
        <FilterChips chips={chips} onClearAll={() => onClearChips?.()} />
      ) : null}

      <div
        className={cn(
          bordered
            ? "table-scroll-x min-w-0 rounded-lg border"
            : "table-scroll-x min-w-0",
          refetching && "opacity-60",
        )}
      >
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : showEmpty ? (
          <div className="text-muted-foreground px-3 py-10 text-left text-sm">
            {emptyContent ?? emptyMessage}
          </div>
        ) : (
          <DataTable
            table={table}
            columnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            pinnedColumnId={pinnedColumnId}
            columnFlexMode={columnFlexMode}
            contentMinWidths={contentMinWidths}
            emptyMessage={emptyMessage}
            onRowClick={onRowClick}
          />
        )}
      </div>

      <TablePagination
        total={total}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}
