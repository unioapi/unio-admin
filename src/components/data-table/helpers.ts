import type { ColumnDef, ColumnSizingState } from "@tanstack/react-table";
import type { TableColumnAlign } from "@/lib/table-columns";
import type { TableLayoutPrefs } from "./use-persisted-table-state";

/** 列定义 meta：列设置菜单用 label；align 控制表头/单元格对齐。 */
export type DataTableColumnMeta = {
  label?: string;
  align?: TableColumnAlign;
};

const DEFAULT_SIZE = 120;
const DEFAULT_MIN = 72;
const DEFAULT_MAX = 480;

/** 运维列表默认列宽（px）。 */
export function resizableColumn<TData>(
  id: string,
  def: Omit<
    ColumnDef<TData, unknown>,
    "id" | "size" | "minSize" | "maxSize" | "enableResizing" | "enableHiding"
  > & {
    size?: number;
    minSize?: number;
    maxSize?: number;
    enableHiding?: boolean;
    meta?: DataTableColumnMeta;
  },
): ColumnDef<TData, unknown> {
  const {
    size = DEFAULT_SIZE,
    minSize = DEFAULT_MIN,
    maxSize = DEFAULT_MAX,
    enableHiding = true,
    meta,
    ...rest
  } = def;
  return {
    id,
    size,
    minSize,
    maxSize,
    enableResizing: true,
    enableHiding,
    meta: { label: meta?.label, ...meta },
    ...rest,
  };
}

/** 从列定义提取默认布局（顺序 / 宽度 / 显隐）。 */
export function defaultTableLayout<TData>(
  columns: ColumnDef<TData, unknown>[],
): TableLayoutPrefs {
  const columnOrder: string[] = [];
  const columnSizing: ColumnSizingState = {};
  for (const col of columns) {
    const id = col.id ?? ("accessorKey" in col ? String(col.accessorKey) : "");
    if (!id) continue;
    columnOrder.push(id);
    columnSizing[id] = col.size ?? DEFAULT_SIZE;
  }
  return { columnOrder, columnVisibility: {}, columnSizing };
}

/** 持久化列宽下限，防止拖拽或旧数据压到不可读。 */
export function clampColumnSizing(
  sizing: ColumnSizingState,
  columns: ColumnDef<unknown, unknown>[],
): ColumnSizingState {
  const out = { ...sizing };
  for (const col of columns) {
    const id = col.id ?? ("accessorKey" in col ? String(col.accessorKey) : "");
    if (!id) continue;
    const min = col.minSize ?? DEFAULT_MIN;
    const fallback = col.size ?? DEFAULT_SIZE;
    const v = out[id] ?? fallback;
    out[id] = Math.max(v, min);
  }
  return out;
}

/** 列设置下拉的人类可读标签。 */
export function columnLabelsFromDefs<TData>(
  columns: ColumnDef<TData, unknown>[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const col of columns) {
    const id = col.id ?? ("accessorKey" in col ? String(col.accessorKey) : "");
    if (!id) continue;
    const meta = col.meta as DataTableColumnMeta | undefined;
    if (typeof col.header === "string") labels[id] = col.header;
    else if (meta?.label) labels[id] = meta.label;
    else labels[id] = id;
  }
  return labels;
}
