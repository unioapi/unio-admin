import { useCallback, useEffect, useMemo, useState } from "react";
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
  columnSizingSignature?: string;
};

type StoredTableLayoutPrefs = TableLayoutPrefs & {
  /** 列结构指纹；与 defaults 不一致时丢弃持久化列宽。 */
  _layoutKey?: string;
};

const STORAGE_PREFIX = "unio-admin:table-layout:";

type StoredPrefsState = {
  layoutKey: string;
  prefs: TableLayoutPrefs;
};

function pinActionLast(order: ColumnOrderState): ColumnOrderState {
  if (!order.includes("action")) return order;
  return [...order.filter((id) => id !== "action"), "action"];
}

function mergeColumnOrder(
  saved: ColumnOrderState | undefined,
  defaultOrder: ColumnOrderState,
): ColumnOrderState {
  if (!saved?.length) return pinActionLast(defaultOrder);
  const allowed = new Set(defaultOrder);
  const ordered = saved.filter((id) => allowed.has(id));
  for (const id of defaultOrder) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return pinActionLast(ordered);
}

function loadPrefs(
  key: string,
  defaults: TableLayoutPrefs,
  sanitize?: (prefs: TableLayoutPrefs) => TableLayoutPrefs,
): TableLayoutPrefs {
  const currentLayoutKey = layoutKey(key, defaults);
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return sanitize ? sanitize(defaults) : defaults;
    const parsed = JSON.parse(raw) as Partial<StoredTableLayoutPrefs>;
    const structureChanged =
      parsed._layoutKey == null || parsed._layoutKey !== currentLayoutKey;
    const columnSizing = structureChanged
      ? defaults.columnSizing
      : parsed.columnSizingSignature
        ? defaults.columnSizing
        : { ...defaults.columnSizing, ...parsed.columnSizing };
    const merged: TableLayoutPrefs = {
      // 列默认顺序变了（layoutKey 变）时跟新默认，避免旧拖拽顺序盖住产品调整。
      columnOrder: structureChanged
        ? pinActionLast(defaults.columnOrder)
        : mergeColumnOrder(parsed.columnOrder, defaults.columnOrder),
      columnVisibility: {
        ...defaults.columnVisibility,
        ...parsed.columnVisibility,
      },
      columnSizing,
      columnSizingSignature: structureChanged
        ? defaults.columnSizingSignature
        : parsed.columnSizingSignature != null
          ? defaults.columnSizingSignature
          : parsed.columnSizingSignature,
    };
    return sanitize ? sanitize(merged) : merged;
  } catch {
    return sanitize ? sanitize(defaults) : defaults;
  }
}

function layoutKey(storageKey: string, defaults: TableLayoutPrefs): string {
  return [
    storageKey,
    defaults.columnOrder.join(","),
    defaults.columnSizingSignature ?? "",
  ].join("|");
}

export function usePersistedTableState(
  storageKey: string,
  defaults: TableLayoutPrefs,
  sanitize?: (prefs: TableLayoutPrefs) => TableLayoutPrefs,
) {
  const currentLayoutKey = layoutKey(storageKey, defaults);
  const [state, setState] = useState<StoredPrefsState>(() => ({
    layoutKey: currentLayoutKey,
    prefs: loadPrefs(storageKey, defaults, sanitize),
  }));

  const loadedPrefs = useMemo(
    () => loadPrefs(storageKey, defaults, sanitize),
    [defaults, sanitize, storageKey],
  );

  const prefs = state.layoutKey === currentLayoutKey ? state.prefs : loadedPrefs;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_PREFIX + storageKey,
      JSON.stringify({ ...prefs, _layoutKey: currentLayoutKey } satisfies StoredTableLayoutPrefs),
    );
  }, [currentLayoutKey, storageKey, prefs]);

  const basePrefs = useCallback(
    (prev: StoredPrefsState) =>
      prev.layoutKey === currentLayoutKey
        ? prev.prefs
        : loadPrefs(storageKey, defaults, sanitize),
    [currentLayoutKey, defaults, sanitize, storageKey],
  );

  const setColumnOrder: OnChangeFn<ColumnOrderState> = useCallback((updater) => {
    setState((prev) => {
      const base = basePrefs(prev);
      return {
        layoutKey: currentLayoutKey,
        prefs: {
          ...base,
          columnOrder:
            typeof updater === "function" ? updater(base.columnOrder) : updater,
        },
      };
    });
  }, [basePrefs, currentLayoutKey]);

  const setColumnVisibility: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      setState((prev) => {
        const base = basePrefs(prev);
        return {
          layoutKey: currentLayoutKey,
          prefs: {
            ...base,
            columnVisibility:
              typeof updater === "function"
                ? updater(base.columnVisibility)
                : updater,
          },
        };
      });
    },
    [basePrefs, currentLayoutKey],
  );

  const setColumnSizing: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      setState((prev) => {
        const base = basePrefs(prev);
        return {
          layoutKey: currentLayoutKey,
          prefs: {
            ...base,
            columnSizing:
              typeof updater === "function" ? updater(base.columnSizing) : updater,
            columnSizingSignature: undefined,
          },
        };
      });
    },
    [basePrefs, currentLayoutKey],
  );

  const resetLayout = useCallback(() => {
    setState({ layoutKey: currentLayoutKey, prefs: defaults });
    localStorage.removeItem(STORAGE_PREFIX + storageKey);
  }, [currentLayoutKey, defaults, storageKey]);

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
