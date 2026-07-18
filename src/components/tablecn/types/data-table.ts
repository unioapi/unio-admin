import type { ColumnSort, Row } from "@tanstack/react-table";
import type { ComponentProps, ComponentType } from "react";

import type { DataTableConfig } from "@/components/tablecn/config/data-table";
import type { FilterItemSchema } from "@/components/tablecn/lib/parsers";

export interface QueryKeys {
  page: string;
  perPage: string;
  sort: string;
  filters: string;
  joinOperator: string;
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: ComponentType<ComponentProps<"svg">>;
}

export type FilterOperator = DataTableConfig["operators"][number];
export type FilterVariant = DataTableConfig["filterVariants"][number];
export type JoinOperator = DataTableConfig["joinOperators"][number];

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  /** 列 id；允许自定义列（如 timing）不必是行字段名 */
  id: string;
  /** 保留泛型占位，便于调用处推断 */
  _row?: TData;
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: string;
  _row?: TData;
}

export interface DataTableRowAction<TData> {
  row: Row<TData>;
  variant: "update" | "delete";
}
