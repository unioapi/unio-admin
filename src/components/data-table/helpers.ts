import type { ColumnDef } from "@tanstack/react-table";

type DataTableColumnMeta = {
  label?: string;
  align?: "left" | "right" | "center";
  fixedWidth?: boolean;
  fillWidth?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoSizeValue?: (row: any) => unknown;
};

const DEFAULT_SIZE = 120;
const DEFAULT_MIN = 72;
const DEFAULT_MAX = 480;

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
