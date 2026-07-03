import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  type ColumnOrderState,
  type Header,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tableAlignClass } from "@/lib/table-columns";
import {
  countFlexColumns,
  headerColStyle,
  isActionColumn,
  isFixedWidthColumn,
  isLayoutFixedColumn,
  resolveColumnMinWidth,
  sumFlexHeadersMinWidth,
  sumHeadersMinWidth,
  type ColumnFlexMode,
  type DataTableColumnMeta,
} from "./helpers";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** 表头/表体统一左侧留白，拖拽手柄独占此区域，不与文字重叠。 */
const HEAD_GUTTER = "pl-6";

function DraggableTableHead<TData>({
  header,
  canReorder,
  columnFlexMode,
  contentMinWidths,
}: {
  header: Header<TData, unknown>;
  canReorder: boolean;
  columnFlexMode: ColumnFlexMode;
  contentMinWidths?: Record<string, number>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
    disabled: !canReorder,
  });

  const minWidth = resolveColumnMinWidth(header, contentMinWidths);
  const fixed = isLayoutFixedColumn(header, columnFlexMode);
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
  const useGutter = !isActionColumn(header) && !isFixedWidthColumn(header);

  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(minWidth != null ? { minWidth } : null),
        ...(fixed && minWidth != null ? { maxWidth: minWidth } : null),
      }}
      className={cn(
        "group/head relative select-none pr-2 align-middle",
        !fixed && "overflow-hidden truncate",
        useGutter && HEAD_GUTTER,
        tableAlignClass(meta?.align),
        isDragging && "z-10 bg-muted/80 opacity-90",
      )}
    >
      {canReorder ? (
        <span className="absolute inset-y-0 left-0 flex w-6 items-center justify-center">
          <button
            type="button"
            className={cn(
              "text-muted-foreground hover:text-foreground z-20 cursor-grab touch-none transition-opacity active:cursor-grabbing",
              isDragging
                ? "opacity-100"
                : "opacity-0 group-hover/head:opacity-100 focus:opacity-100",
            )}
            aria-label="拖拽调整列顺序"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        </span>
      ) : null}
      <span className={cn("min-w-0", !fixed && "truncate")}>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    </TableHead>
  );
}

export function DataTable<TData>({
  table,
  columnOrder,
  onColumnOrderChange,
  pinnedColumnId = "name",
  columnFlexMode = "equal",
  contentMinWidths,
  emptyMessage = "暂无数据",
  onRowClick,
}: {
  table: TanstackTable<TData>;
  columnOrder: ColumnOrderState;
  onColumnOrderChange: (order: ColumnOrderState) => void;
  pinnedColumnId?: string | null;
  /** proportional：按 minSize 比例；equal：弹性列等分容器宽度 */
  columnFlexMode?: ColumnFlexMode;
  /** 按当前数据估算的列 minWidth；未传则回退列定义 minSize */
  contentMinWidths?: Record<string, number>;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onColumnOrderChange(
      arrayMove(
        columnOrder,
        columnOrder.indexOf(String(active.id)),
        columnOrder.indexOf(String(over.id)),
      ),
    );
  };

  const headerGroup = table.getHeaderGroups()[0];
  const headers = headerGroup?.headers ?? [];
  const sortableIds = headers.map((h) => h.column.id);
  const totalMinWidth = useMemo(
    () => sumHeadersMinWidth(headers, contentMinWidths),
    [contentMinWidths, headers],
  );
  const flexMinTotal = useMemo(
    () => sumFlexHeadersMinWidth(headers, contentMinWidths),
    [contentMinWidths, headers],
  );
  const flexColumnCount = useMemo(
    () => countFlexColumns(headers, columnFlexMode),
    [columnFlexMode, headers],
  );
  const colStyleOptions = useMemo(
    () => ({ mode: columnFlexMode, flexColumnCount, contentMinWidths }),
    [columnFlexMode, contentMinWidths, flexColumnCount],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      {/* 窄屏时撑开至列 minWidth 之和，触发外层 overflow-x-auto 出横向滚动条 */}
      <div className="w-full" style={{ minWidth: totalMinWidth }}>
        <table className="w-full caption-bottom text-sm table-fixed">
          <colgroup>
            {headers.map((header) => (
              <col
                key={header.id}
                style={headerColStyle(header, flexMinTotal, colStyleOptions)}
              />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                <SortableContext
                  items={sortableIds}
                  strategy={horizontalListSortingStrategy}
                >
                  {group.headers.map((header) => (
                    <DraggableTableHead
                      key={header.id}
                      header={header}
                      columnFlexMode={columnFlexMode}
                      contentMinWidths={contentMinWidths}
                    canReorder={
                      pinnedColumnId == null
                        ? header.column.id !== "action" &&
                          !isFixedWidthColumn(header)
                        : header.column.id !== pinnedColumnId &&
                          header.column.id !== "action" &&
                          !isFixedWidthColumn(header)
                    }
                    />
                  ))}
                </SortableContext>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    onRowClick &&
                      "cursor-pointer transition-colors hover:bg-accent/50",
                  )}
                  onClick={
                    onRowClick
                      ? () => onRowClick(row.original)
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | DataTableColumnMeta
                      | undefined;
                    const minWidth = resolveColumnMinWidth(
                      {
                        column: {
                          id: cell.column.id,
                          columnDef: cell.column.columnDef,
                        },
                      },
                      contentMinWidths,
                    );
                    const fixed = isLayoutFixedColumn(
                      {
                        column: {
                          id: cell.column.id,
                          columnDef: cell.column.columnDef,
                        },
                      },
                      columnFlexMode,
                    );
                    const isAction = cell.column.id === "action";
                    const useGutter =
                      !isAction &&
                      !isFixedWidthColumn({
                        column: { columnDef: cell.column.columnDef },
                      });
                    return (
                      <TableCell
                        key={cell.id}
                        style={{
                          minWidth,
                          ...(fixed && minWidth != null ? { maxWidth: minWidth } : null),
                        }}
                        className={cn(
                          !isAction && "overflow-hidden",
                          !fixed && "truncate",
                          useGutter && HEAD_GUTTER,
                          tableAlignClass(meta?.align),
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="text-muted-foreground h-24 text-left"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </DndContext>
  );
}
