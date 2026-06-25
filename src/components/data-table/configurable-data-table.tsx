import { useCallback, useMemo, type ReactNode } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "./data-table";
import { DataTableViewOptions } from "./data-table-view-options";
import {
  clampColumnSizing,
  columnLabelsFromDefs,
  defaultTableLayout,
} from "./helpers";
import {
  usePersistedTableState,
  type TableLayoutPrefs,
} from "./use-persisted-table-state";

export type ConfigurableDataTableProps<TData> = {
  /** localStorage 键（不含前缀），如 `providers:ops-table` */
  storageKey: string;
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  columnLabels?: Record<string, string>;
  /** 不参与拖拽的列 id；默认 `name`；传 null 则全部可拖 */
  pinnedColumnId?: string | null;
  defaultLayout?: TableLayoutPrefs;
  sanitizeLayout?: (prefs: TableLayoutPrefs) => TableLayoutPrefs;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  emptyMessage?: string;
  /** 自定义空状态（替代 emptyMessage 文案） */
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
};

function TableToolbar({
  toolbarStart,
  toolbarEnd,
  table,
  columnLabels,
  onReset,
}: {
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  table: ReturnType<typeof useReactTable<unknown>>;
  columnLabels: Record<string, string>;
  onReset: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {toolbarStart}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {toolbarEnd}
        <DataTableViewOptions
          table={table}
          labels={columnLabels}
          onReset={onReset}
        />
      </div>
    </div>
  );
}

/**
 * 可配置运维列表：列显隐 / 列宽 / 列顺序 + localStorage 持久化。
 */
export function ConfigurableDataTable<TData>({
  storageKey,
  data,
  columns,
  columnLabels: columnLabelsProp,
  pinnedColumnId = "name",
  defaultLayout: defaultLayoutProp,
  sanitizeLayout,
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
}: ConfigurableDataTableProps<TData>) {
  const defaultLayout = useMemo(
    () => defaultLayoutProp ?? defaultTableLayout(columns),
    [columns, defaultLayoutProp],
  );

  const sanitizePrefs = useCallback(
    (prefs: TableLayoutPrefs) => {
      const clamped: TableLayoutPrefs = {
        ...prefs,
        columnSizing: clampColumnSizing(
          prefs.columnSizing,
          columns as ColumnDef<unknown, unknown>[],
        ),
      };
      return sanitizeLayout ? sanitizeLayout(clamped) : clamped;
    },
    [columns, sanitizeLayout],
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

  const columnLabels = useMemo(
    () => columnLabelsProp ?? columnLabelsFromDefs(columns),
    [columnLabelsProp, columns],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnOrder, columnVisibility, columnSizing },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getRowId,
  });

  const borderWrap = bordered ? "overflow-x-auto rounded-lg border" : "overflow-x-auto";

  const toolbar = (
    <TableToolbar
      toolbarStart={toolbarStart}
      toolbarEnd={toolbarEnd}
      table={table as ReturnType<typeof useReactTable<unknown>>}
      columnLabels={columnLabels}
      onReset={resetLayout}
    />
  );

  if (loading) {
    return (
      <div className={className}>
        {toolbar}
        <div className={cn(borderWrap, "p-3")}>
          {Array.from({ length: loadingRows }).map((_, i) => (
            <Skeleton key={i} className={cn("h-8 w-full", i < loadingRows - 1 && "mb-2")} />
          ))}
        </div>
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

  return (
    <div className={className}>
      {toolbar}
      <div className={cn(borderWrap, tableClassName)}>
        <DataTable
          table={table}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          pinnedColumnId={pinnedColumnId}
          emptyMessage={emptyMessage}
          onRowClick={onRowClick}
        />
      </div>
    </div>
  );
}
