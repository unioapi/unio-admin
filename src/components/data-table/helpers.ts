import type { ColumnDef, ColumnSizingState } from "@tanstack/react-table";
import type { TableColumnAlign } from "@/lib/table-columns";
import type { TableLayoutPrefs } from "./use-persisted-table-state";

/** 列定义 meta：列设置菜单用 label；align 控制表头/单元格对齐；fixedWidth 不参与比例拉伸。 */
export type DataTableColumnMeta = {
  label?: string;
  align?: TableColumnAlign;
  /** 固定宽度（如 Badge 列），不参与剩余空间比例分配 */
  fixedWidth?: boolean;
};

const DEFAULT_SIZE = 120;
const DEFAULT_MIN = 72;
const DEFAULT_MAX = 480;
const DEFAULT_AUTOSIZE_PADDING = 44;
const DEFAULT_AUTOSIZE_SAMPLE_SIZE = 80;

/** 运维 / 详情表常用列 id 的默认宽度（px）。 */
export const STANDARD_COLUMN_SIZES: Record<string, { size: number; minSize: number }> = {
  name: { size: 220, minSize: 140 },
  model: { size: 200, minSize: 140 },
  model_ref: { size: 200, minSize: 140 },
  channel: { size: 200, minSize: 140 },
  channel_name: { size: 200, minSize: 140 },
  route: { size: 180, minSize: 120 },
  requests: { size: 96, minSize: 72 },
  request_id: { size: 140, minSize: 100 },
  attempt_total: { size: 96, minSize: 72 },
  success_rate: { size: 96, minSize: 80 },
  latency: { size: 112, minSize: 88 },
  latency_p95: { size: 112, minSize: 88 },
  timeout: { size: 80, minSize: 64 },
  bound_models: { size: 88, minSize: 64 },
  recent_error: { size: 140, minSize: 100 },
  recent_error_code: { size: 140, minSize: 100 },
  protocol_adapter: { size: 140, minSize: 112 },
  credential: { size: 180, minSize: 140 },
  rate_limit: { size: 112, minSize: 96 },
  status: { size: 88, minSize: 72 },
  health: { size: 88, minSize: 72 },
  health_bucket: { size: 88, minSize: 72 },
  price: { size: 96, minSize: 72 },
  has_price: { size: 96, minSize: 72 },
  upstream_model: { size: 160, minSize: 120 },
  upstream_name: { size: 160, minSize: 120 },
  error_code: { size: 120, minSize: 88 },
  http: { size: 72, minSize: 56 },
  upstream_status_code: { size: 72, minSize: 56 },
  time: { size: 112, minSize: 88 },
  at: { size: 112, minSize: 88 },
  created_at: { size: 160, minSize: 128 },
  datetime: { size: 176, minSize: 128 },
  id: { size: 88, minSize: 64 },
  tokens: { size: 96, minSize: 72 },
  channels: { size: 72, minSize: 56 },
  tps: { size: 88, minSize: 72 },
  avg_tps: { size: 88, minSize: 72 },
  margin: { size: 112, minSize: 88 },
  money: { size: 112, minSize: 88 },
  route_name: { size: 140, minSize: 100 },
  spend_limit: { size: 96, minSize: 72 },
  spent: { size: 124, minSize: 96 },
  consumption: { size: 112, minSize: 88 },
  last_used: { size: 120, minSize: 96 },
  user: { size: 140, minSize: 100 },
  source: { size: 120, minSize: 88 },
  mode: { size: 100, minSize: 72 },
  pool_kind: { size: 100, minSize: 72 },
  strategy: { size: 100, minSize: 72 },
  vendor: { size: 120, minSize: 88 },
  key: { size: 180, minSize: 120 },
  project: { size: 160, minSize: 120 },
  action: { size: 120, minSize: 120 },
  capabilities: { size: 88, minSize: 64 },
  adopted: { size: 88, minSize: 64 },
  domain: { size: 120, minSize: 88 },
  key_label: { size: 200, minSize: 140 },
};

/** 表头列最小宽度（px）。 */
export function headerMinWidth<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
): number {
  return header.column.columnDef.minSize ?? DEFAULT_MIN;
}

/** 可见列 minSize 之和，用于表格横向滚动下限。 */
export function sumHeadersMinWidth<TData>(
  headers: { column: { columnDef: ColumnDef<TData, unknown> } }[],
): number {
  return headers.reduce((sum, header) => sum + headerMinWidth(header), 0);
}

export function isFixedWidthColumn<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
): boolean {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
  return meta?.fixedWidth === true;
}

/** 参与比例分配的列 minSize 之和（排除 fixedWidth / action 列）。 */
export function sumFlexHeadersMinWidth<TData>(
  headers: { column: { columnDef: ColumnDef<TData, unknown> } }[],
): number {
  return headers.reduce((sum, header) => {
    if (isFixedWidthColumn(header) || isActionColumn(header)) return sum;
    return sum + headerMinWidth(header);
  }, 0);
}

/** 按 minSize 比例分配列宽：宽屏一起变宽，窄屏不低于 minSize。 */
export function proportionalColumnStyle(
  minWidth: number,
  totalMin: number,
): { width: string; minWidth: number } {
  if (totalMin <= 0) return { width: "auto", minWidth };
  return {
    width: `${(minWidth / totalMin) * 100}%`,
    minWidth,
  };
}

export function isActionColumn<TData>(
  header: {
    column: {
      id?: string;
      columnDef: ColumnDef<TData, unknown>;
    };
  },
): boolean {
  const id =
    header.column.id ??
    (header.column.columnDef.id ??
      ("accessorKey" in header.column.columnDef
        ? String(header.column.columnDef.accessorKey)
        : ""));
  return id === "action";
}

/** 单列 col 宽度：fixedWidth / action 列锁死 minSize，其余按比例分配。 */
export function headerColStyle<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
  flexMinTotal: number,
): { width: number | string; minWidth: number; maxWidth?: number } {
  const minWidth = headerMinWidth(header);
  if (isFixedWidthColumn(header) || isActionColumn(header)) {
    return { width: minWidth, minWidth, maxWidth: minWidth };
  }
  return proportionalColumnStyle(minWidth, flexMinTotal);
}

/** 为列定义补全 size / minSize / maxSize（未显式设置的列）。 */
export function ensureResizableColumns<TData>(
  columns: ColumnDef<TData, unknown>[],
): ColumnDef<TData, unknown>[] {
  return columns.map((col) => {
    const id = columnId(col);
    if (!id) return col;
    const preset = STANDARD_COLUMN_SIZES[id];
    const meta = col.meta as DataTableColumnMeta | undefined;
    return {
      ...col,
      size: col.size ?? preset?.size ?? DEFAULT_SIZE,
      minSize: col.minSize ?? preset?.minSize ?? DEFAULT_MIN,
      maxSize: col.maxSize ?? DEFAULT_MAX,
      enableResizing: false,
      meta,
    };
  });
}

/** 首列（enableHiding: false 且非 action）作为拖拽固定列。 */
export function pinnedColumnIdFromDefs<TData>(
  columns: ColumnDef<TData, unknown>[],
  fallback = "name",
): string {
  const pinned = columns.find(
    (col) => col.id !== "action" && col.enableHiding === false,
  );
  if (pinned) return columnId(pinned) || fallback;
  const first = columns[0];
  return first ? columnId(first) || fallback : fallback;
}

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
    const preset = STANDARD_COLUMN_SIZES[id];
    columnSizing[id] = col.size ?? preset?.size ?? DEFAULT_SIZE;
  }
  return { columnOrder, columnVisibility: {}, columnSizing };
}

function columnId<TData>(col: ColumnDef<TData, unknown>): string {
  return col.id ?? ("accessorKey" in col ? String(col.accessorKey) : "");
}

function columnBounds<TData>(col: ColumnDef<TData, unknown>) {
  return {
    min: col.minSize ?? DEFAULT_MIN,
    max: col.maxSize ?? DEFAULT_MAX,
    fallback: col.size ?? DEFAULT_SIZE,
  };
}

function formatAutoSizeValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function estimateTextWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    if (/\s/.test(char)) width += 4;
    else if (/[\u4e00-\u9fff]/.test(char)) width += 14;
    else if (/[0-9]/.test(char)) width += 8;
    else if (/[A-Z]/.test(char)) width += 8;
    else if (/[a-z]/.test(char)) width += 7;
    else width += 6;
  }
  return width;
}

function clampSize(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.ceil(value), min), max);
}

function sizingSignature(sizing: ColumnSizingState): string {
  return Object.entries(sizing)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, size]) => `${id}:${Math.round(size)}`)
    .join("|");
}

/** 根据表头 + 可见数据估算默认列宽；仍保留用户拖拽后的持久化列宽。 */
export function autoSizeTableLayout<TData>(
  columns: ColumnDef<TData, unknown>[],
  data: TData[],
  labels: Record<string, string>,
  getAutoSizeValue?: (row: TData, columnId: string) => unknown,
  sampleSize = DEFAULT_AUTOSIZE_SAMPLE_SIZE,
): TableLayoutPrefs {
  const layout = defaultTableLayout(columns);
  const rows = data.slice(0, sampleSize);

  for (const col of columns) {
    const id = columnId(col);
    if (!id) continue;

    const { min, max, fallback } = columnBounds(col);
    let width = estimateTextWidth(labels[id] ?? id) + DEFAULT_AUTOSIZE_PADDING;

    for (const row of rows) {
      const raw =
        getAutoSizeValue?.(row, id) ??
        ("accessorKey" in col && typeof col.accessorKey === "string"
          ? (row as Record<string, unknown>)[col.accessorKey]
          : undefined);
      width = Math.max(width, estimateTextWidth(formatAutoSizeValue(raw)) + DEFAULT_AUTOSIZE_PADDING);
    }

    layout.columnSizing[id] = clampSize(width || fallback, min, max);
  }

  layout.columnSizingSignature = sizingSignature(layout.columnSizing);
  return layout;
}

/** 持久化列宽下限，防止旧数据压到不可读。 */
export function clampColumnSizing(
  sizing: ColumnSizingState,
  columns: ColumnDef<unknown, unknown>[],
): ColumnSizingState {
  const out = { ...sizing };
  for (const col of columns) {
    const id = columnId(col);
    if (!id) continue;
    const { min, fallback } = columnBounds(col);
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
    const id = columnId(col);
    if (!id) continue;
    const meta = col.meta as DataTableColumnMeta | undefined;
    if (typeof col.header === "string") labels[id] = col.header;
    else if (meta?.label) labels[id] = meta.label;
    else labels[id] = id;
  }
  return labels;
}
