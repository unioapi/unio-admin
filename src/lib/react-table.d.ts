import type { FilterFn, Row, RowData } from "@tanstack/react-table";
import type { ComponentProps, ComponentType } from "react";

declare module "@tanstack/react-table" {
  // https://github.com/TanStack/table/issues/44#issuecomment-1377024296
  interface TableMeta<TData extends RowData> {
    getRowClassName?: (row: Row<TData>) => string;
    queryKeys?: {
      page: string;
      perPage: string;
      sort: string;
      filters: string;
      joinOperator: string;
    };
  }

  interface ColumnMeta<_TData extends RowData = RowData, _TValue = unknown> {
    headerClassName?: string;
    cellClassName?: string;
    label?: string;
    kind?: string;
    /** 固定宽度列，不参与比例拉伸（如 Badge 列） */
    fixedWidth?: boolean;
    /** content 模式下吸收剩余宽度 */
    fillWidth?: boolean;
    /** 按行估算列内容宽度（用于动态 minWidth） */
    autoSizeValue?: (row: any) => unknown;
    /** tablecn Data Table 筛选 */
    placeholder?: string;
    variant?:
      | "text"
      | "number"
      | "range"
      | "date"
      | "dateRange"
      | "boolean"
      | "select"
      | "multiSelect";
    options?: {
      label: string;
      value: string;
      count?: number;
      icon?: ComponentType<ComponentProps<"svg">>;
    }[];
    range?: [number, number];
    unit?: string;
    icon?: ComponentType<ComponentProps<"svg">>;
  }

  interface FilterFns {
    inDateRange?: FilterFn<any>;
    arrSome?: FilterFn<any>;
  }

  // https://github.com/TanStack/table/discussions/4554
  interface ColumnFiltersOptions<TData extends RowData> {
    filterFns?: Record<string, FilterFn<TData>>;
  }
}
