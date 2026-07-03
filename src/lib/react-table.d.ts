import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // https://github.com/TanStack/table/issues/44#issuecomment-1377024296
  interface TableMeta<TData extends unknown> {
    getRowClassName?: (row: Row<TData>) => string;
  }

  interface ColumnMeta {
    headerClassName?: string;
    cellClassName?: string;
    label?: string;
    kind?: string;
    /** 固定宽度列，不参与比例拉伸（如 Badge 列） */
    fixedWidth?: boolean;
    /** 按行估算列内容宽度（用于动态 minWidth） */
    autoSizeValue?: (row: any) => unknown;
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
