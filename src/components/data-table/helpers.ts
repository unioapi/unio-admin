import type { ColumnDef, ColumnSizingState } from "@tanstack/react-table";
import type { TableColumnAlign } from "@/lib/table-columns";
import { formatDateTime, formatInt, formatLatencyMs, formatPercent, maskSecret } from "@/lib/format";
import type { TableLayoutPrefs } from "./use-persisted-table-state";

/** 列定义 meta：列设置菜单用 label；align 控制表头/单元格对齐；fixedWidth 不参与比例拉伸。 */
export type DataTableColumnMeta = {
  label?: string;
  align?: TableColumnAlign;
  /** 固定宽度（如 Badge 列），不参与剩余空间比例分配 */
  fixedWidth?: boolean;
  /** content 模式下吸收剩余宽度（表拉满容器时，其它列仍贴合内容） */
  fillWidth?: boolean;
  /** 按行估算列内容宽度（用于动态 minWidth）；各列按自身行类型定义，故此处用 any 逃生舱。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoSizeValue?: (row: any) => unknown;
};

const DEFAULT_SIZE = 120;
const DEFAULT_MIN = 72;
const DEFAULT_MAX = 480;
const DEFAULT_AUTOSIZE_PADDING = 44;
/** content 模式：贴合内容，减少「看起来每列都很空」。 */
const COMPACT_AUTOSIZE_PADDING = 18;
const DEFAULT_AUTOSIZE_SAMPLE_SIZE = 80;
/** 与 DataTable 表头/单元格 pl-6 拖拽留白一致。 */
const TABLE_HEAD_GUTTER_PX = 24;
const COMPACT_HEAD_GUTTER_PX = 12;
const CONTENT_MIN_FLOOR = 40;
const ACTION_COLUMN_MIN = 72;
/** 凭证列复制按钮占位（与 icon-sm 按钮 + gap 对齐）。 */
const CREDENTIAL_COPY_BTN_PX = 32;

/** 运维 / 详情表常用列 id 的默认宽度（px）。 */
const STANDARD_COLUMN_SIZES: Record<string, { size: number; minSize: number }> = {
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
  bound_routes: { size: 88, minSize: 64 },
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
  channels: { size: 80, minSize: 80 },
  models: { size: 80, minSize: 80 },
  routes: { size: 80, minSize: 80 },
  last_test: { size: 96, minSize: 72 },
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

/** 表头列最小宽度（px，列定义 fallback）。 */
function headerMinWidth<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
): number {
  return header.column.columnDef.minSize ?? DEFAULT_MIN;
}

/** 解析列 minWidth：优先使用按内容估算的宽度。 */
export function resolveColumnMinWidth<TData>(
  header: { column: { id: string; columnDef: ColumnDef<TData, unknown> } },
  contentMinWidths?: Record<string, number>,
): number {
  const id = header.column.id;
  if (contentMinWidths && id in contentMinWidths) {
    return contentMinWidths[id];
  }
  return headerMinWidth(header);
}

/** 可见列 minSize 之和，用于表格横向滚动下限。 */
export function sumHeadersMinWidth<TData>(
  headers: { column: { id: string; columnDef: ColumnDef<TData, unknown> } }[],
  contentMinWidths?: Record<string, number>,
): number {
  return headers.reduce(
    (sum, header) => sum + resolveColumnMinWidth(header, contentMinWidths),
    0,
  );
}

export function isFixedWidthColumn<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
): boolean {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
  return meta?.fixedWidth === true;
}

export function isFillWidthColumn<TData>(
  header: { column: { columnDef: ColumnDef<TData, unknown> } },
): boolean {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
  return meta?.fillWidth === true;
}

/** 参与比例分配的列 minSize 之和。
 * - proportional：排除 fixedWidth / action
 * - content：全部列按内容宽度参与（含操作列），比例之和 = 100%
 */
export function sumFlexHeadersMinWidth<TData>(
  headers: { column: { id: string; columnDef: ColumnDef<TData, unknown> } }[],
  contentMinWidths?: Record<string, number>,
  mode: "proportional" | "equal" | "content" = "proportional",
): number {
  return headers.reduce((sum, header) => {
    if (mode === "content") {
      return sum + resolveColumnMinWidth(header, contentMinWidths);
    }
    if (isFixedWidthColumn(header) || isActionColumn(header)) return sum;
    return sum + resolveColumnMinWidth(header, contentMinWidths);
  }, 0);
}

/** 按 minSize 比例分配列宽：宽屏一起变宽，窄屏不低于 minSize。 */
function proportionalColumnStyle(
  minWidth: number,
  totalMin: number,
): { width: string; minWidth: number } {
  if (totalMin <= 0) return { width: "auto", minWidth };
  return {
    width: `${(minWidth / totalMin) * 100}%`,
    minWidth,
  };
}

/** 弹性列等分：占比相同；minWidth 为当前页内容估算下限。 */
function equalColumnStyle(
  minWidth: number,
  flexColumnCount: number,
): { width: string; minWidth: number } {
  if (flexColumnCount <= 0) return { width: "auto", minWidth };
  return {
    width: `${100 / flexColumnCount}%`,
    minWidth,
  };
}

/** 按内容贴合：列宽锁死为估算值（仅 table-fixed 路径使用）。 */
function contentColumnStyle(minWidth: number): {
  width: number;
  minWidth: number;
  maxWidth: number;
} {
  return { width: minWidth, minWidth, maxWidth: minWidth };
}

export type ColumnFlexMode = "proportional" | "equal" | "content";

export function countFlexColumns<TData>(
  headers: { column: { columnDef: ColumnDef<TData, unknown> } }[],
  mode: ColumnFlexMode,
): number {
  return headers.reduce((count, header) => {
    // content：所有列都按内容比例参与
    if (mode === "content") return count + 1;
    if (isActionColumn(header)) return count;
    if (isFixedWidthColumn(header)) return count;
    return count + 1;
  }, 0);
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

/** 渲染层是否锁死列宽（不参与拉伸 / 截断弹性）。 */
export function isLayoutFixedColumn<TData>(
  header: { column: { id?: string; columnDef: ColumnDef<TData, unknown> } },
  mode: ColumnFlexMode,
): boolean {
  // content：全部按内容比例分满，不锁死
  if (mode === "content") return false;
  if (isActionColumn(header)) return true;
  if (isFixedWidthColumn(header)) return true;
  if (mode === "equal") return false;
  return false;
}

/** 单列 col 宽度。content = 按内容估算宽度比例分满整表。 */
export function headerColStyle<TData>(
  header: { column: { id: string; columnDef: ColumnDef<TData, unknown> } },
  flexMinTotal: number,
  options?: {
    mode?: ColumnFlexMode;
    flexColumnCount?: number;
    contentMinWidths?: Record<string, number>;
  },
): { width: number | string; minWidth: number; maxWidth?: number } {
  const minWidth = resolveColumnMinWidth(header, options?.contentMinWidths);
  const mode = options?.mode ?? "proportional";

  // 根据内容比例分满：宽列多占、短列少占，合计 100%
  if (mode === "content") {
    return proportionalColumnStyle(minWidth, flexMinTotal);
  }

  if (isActionColumn(header) || isFixedWidthColumn(header)) {
    return contentColumnStyle(minWidth);
  }

  if (mode === "equal") {
    const flexColumnCount = options?.flexColumnCount ?? 1;
    return equalColumnStyle(minWidth, flexColumnCount);
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

function isActionColumnId(id: string): boolean {
  return id === "action";
}

function columnUsesHeadGutter<TData>(col: ColumnDef<TData, unknown>): boolean {
  const meta = col.meta as DataTableColumnMeta | undefined;
  const id = columnId(col);
  return !isActionColumnId(id) && meta?.fixedWidth !== true;
}

function formatDisplayAutoSizeValue(columnId: string, raw: unknown): unknown {
  if (raw == null) return raw;
  if (columnId === "created_at" && typeof raw === "string") {
    return formatDateTime(raw);
  }
  if (columnId === "success_rate" && typeof raw === "number") {
    return formatPercent(raw);
  }
  if (columnId === "status" && typeof raw === "string") {
    if (raw === "enabled") return "启用";
    if (raw === "disabled") return "停用";
  }
  if (columnId === "credential" && typeof raw === "string") {
    return maskSecret(raw);
  }
  if (
    (columnId === "latency" || columnId === "latency_avg") &&
    typeof raw === "number"
  ) {
    return formatLatencyMs(raw);
  }
  if (columnId === "timeout" || columnId === "timeout_ms") {
    if (raw === 0 || raw == null) return "默认";
    return formatLatencyMs(typeof raw === "number" ? raw : Number(raw));
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (columnId === "bound_models" || columnId === "bound_routes") {
      return formatInt(raw);
    }
  }
  if (columnId === "rate_limit") {
    return "默认";
  }
  return raw;
}

function getCellAutoSizeValue<TData>(
  col: ColumnDef<TData, unknown>,
  row: TData,
  columnId: string,
): unknown {
  const meta = col.meta as DataTableColumnMeta | undefined;
  if (meta?.autoSizeValue) return meta.autoSizeValue(row);
  let raw: unknown;
  if ("accessorFn" in col && typeof col.accessorFn === "function") {
    raw = col.accessorFn(row, 0);
  } else if ("accessorKey" in col && typeof col.accessorKey === "string") {
    raw = (row as Record<string, unknown>)[col.accessorKey];
  }
  return formatDisplayAutoSizeValue(columnId, raw);
}

/** 按表头 + 当前数据估算各列 minWidth；数据变化时重新计算。 */
export function computeContentMinWidths<TData>(
  columns: ColumnDef<TData, unknown>[],
  data: TData[],
  labels: Record<string, string>,
  getAutoSizeValue?: (row: TData, columnId: string) => unknown,
  sampleSizeOrOptions:
    | number
    | {
        sampleSize?: number;
        /** compact：更贴合内容（content 布局模式用） */
        density?: "default" | "compact";
      } = DEFAULT_AUTOSIZE_SAMPLE_SIZE,
): Record<string, number> {
  const options =
    typeof sampleSizeOrOptions === "number"
      ? { sampleSize: sampleSizeOrOptions, density: "default" as const }
      : sampleSizeOrOptions;
  const sampleSize = options.sampleSize ?? DEFAULT_AUTOSIZE_SAMPLE_SIZE;
  const compact = options.density === "compact";
  const padding = compact ? COMPACT_AUTOSIZE_PADDING : DEFAULT_AUTOSIZE_PADDING;
  const gutter = compact ? COMPACT_HEAD_GUTTER_PX : TABLE_HEAD_GUTTER_PX;

  const rows = data.slice(0, sampleSize);
  const result: Record<string, number> = {};

  for (const col of columns) {
    const id = columnId(col);
    if (!id) continue;

    const { max, fallback } = columnBounds(col);
    let width = estimateTextWidth(labels[id] ?? id) + padding;

    if (isActionColumnId(id)) {
      width = Math.max(width, ACTION_COLUMN_MIN);
    } else {
      for (const row of rows) {
        const raw =
          getAutoSizeValue?.(row, id) ?? getCellAutoSizeValue(col, row, id);
        width = Math.max(
          width,
          estimateTextWidth(formatAutoSizeValue(raw)) + padding,
        );
      }
      if (columnUsesHeadGutter(col)) {
        width += gutter;
      }
    }

    result[id] = clampSize(width || fallback, CONTENT_MIN_FLOOR, max);
    if (id === "credential") {
      result[id] += CREDENTIAL_COPY_BTN_PX;
    }
  }

  return result;
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
  const contentMinWidths = computeContentMinWidths(
    columns,
    data,
    labels,
    getAutoSizeValue,
    sampleSize,
  );
  for (const [id, width] of Object.entries(contentMinWidths)) {
    layout.columnSizing[id] = width;
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
