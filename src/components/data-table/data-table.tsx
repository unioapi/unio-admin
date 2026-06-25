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
import { GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tableAlignClass } from "@/lib/table-columns";
import type { DataTableColumnMeta } from "./helpers";
import {
  Table,
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
}: {
  header: Header<TData, unknown>;
  canReorder: boolean;
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/head relative select-none pr-3",
        HEAD_GUTTER,
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
      <span className="min-w-0">
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      {header.column.getCanResize() ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整列宽"
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none",
            "opacity-0 group-hover/head:opacity-100 hover:bg-primary/30 focus:opacity-100",
            header.column.getIsResizing() && "bg-primary/50 opacity-100",
          )}
        />
      ) : null}
    </TableHead>
  );
}

export function DataTable<TData>({
  table,
  columnOrder,
  onColumnOrderChange,
  pinnedColumnId = "name",
  emptyMessage = "暂无数据",
  onRowClick,
}: {
  table: TanstackTable<TData>;
  columnOrder: ColumnOrderState;
  onColumnOrderChange: (order: ColumnOrderState) => void;
  pinnedColumnId?: string | null;
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
  const sortableIds = headerGroup?.headers.map((h) => h.column.id) ?? [];
  const totalSize = Math.max(table.getCenterTotalSize(), 1);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <Table
        className="w-full"
        style={{ minWidth: totalSize }}
      >
        <colgroup>
          {headerGroup?.headers.map((header) => (
            <col
              key={header.id}
              style={{
                width: `${(header.getSize() / totalSize) * 100}%`,
              }}
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
                    canReorder={
                      pinnedColumnId == null
                        ? true
                        : header.column.id !== pinnedColumnId
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
                className={cn(onRowClick && "cursor-pointer")}
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
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "min-w-0",
                        HEAD_GUTTER,
                        tableAlignClass(meta?.align),
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
      </Table>
    </DndContext>
  );
}
