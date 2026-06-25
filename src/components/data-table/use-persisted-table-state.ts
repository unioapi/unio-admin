import { useCallback, useEffect, useState } from "react";
import type {
  ColumnOrderState,
  ColumnSizingState,
  OnChangeFn,
  VisibilityState,
} from "@tanstack/react-table";

export type TableLayoutPrefs = {
  columnOrder: ColumnOrderState;
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
};

const STORAGE_PREFIX = "unio-admin:table-layout:";

function mergeColumnOrder(
  saved: ColumnOrderState | undefined,
  defaultOrder: ColumnOrderState,
): ColumnOrderState {
  if (!saved?.length) return defaultOrder;
  const allowed = new Set(defaultOrder);
  const ordered = saved.filter((id) => allowed.has(id));
  for (const id of defaultOrder) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

function loadPrefs(
  key: string,
  defaults: TableLayoutPrefs,
  sanitize?: (prefs: TableLayoutPrefs) => TableLayoutPrefs,
): TableLayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return sanitize ? sanitize(defaults) : defaults;
    const parsed = JSON.parse(raw) as Partial<TableLayoutPrefs>;
    const merged: TableLayoutPrefs = {
      columnOrder: mergeColumnOrder(parsed.columnOrder, defaults.columnOrder),
      columnVisibility: {
        ...defaults.columnVisibility,
        ...parsed.columnVisibility,
      },
      columnSizing: { ...defaults.columnSizing, ...parsed.columnSizing },
    };
    return sanitize ? sanitize(merged) : merged;
  } catch {
    return sanitize ? sanitize(defaults) : defaults;
  }
}

export function usePersistedTableState(
  storageKey: string,
  defaults: TableLayoutPrefs,
  sanitize?: (prefs: TableLayoutPrefs) => TableLayoutPrefs,
) {
  const [prefs, setPrefs] = useState<TableLayoutPrefs>(() =>
    loadPrefs(storageKey, defaults, sanitize),
  );

  useEffect(() => {
    setPrefs(loadPrefs(storageKey, defaults, sanitize));
  }, [storageKey, defaults, sanitize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(prefs));
  }, [storageKey, prefs]);

  const setColumnOrder: OnChangeFn<ColumnOrderState> = useCallback((updater) => {
    setPrefs((prev) => ({
      ...prev,
      columnOrder:
        typeof updater === "function" ? updater(prev.columnOrder) : updater,
    }));
  }, []);

  const setColumnVisibility: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      setPrefs((prev) => ({
        ...prev,
        columnVisibility:
          typeof updater === "function"
            ? updater(prev.columnVisibility)
            : updater,
      }));
    },
    [],
  );

  const setColumnSizing: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      setPrefs((prev) => ({
        ...prev,
        columnSizing:
          typeof updater === "function" ? updater(prev.columnSizing) : updater,
      }));
    },
    [],
  );

  const resetLayout = useCallback(() => {
    setPrefs(defaults);
    localStorage.removeItem(STORAGE_PREFIX + storageKey);
  }, [defaults, storageKey]);

  return {
    columnOrder: prefs.columnOrder,
    columnVisibility: prefs.columnVisibility,
    columnSizing: prefs.columnSizing,
    setColumnOrder,
    setColumnVisibility,
    setColumnSizing,
    resetLayout,
  };
}
