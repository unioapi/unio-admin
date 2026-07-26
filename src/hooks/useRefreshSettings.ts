import { useCallback, useEffect, useMemo, useState } from "react";

export const REFRESH_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30, 60] as const;
export type RefreshIntervalSec = (typeof REFRESH_INTERVAL_OPTIONS)[number];

export type RefreshSettings = {
  autoRefresh: boolean;
  intervalSec: RefreshIntervalSec;
};

const DEFAULT_SETTINGS: RefreshSettings = {
  autoRefresh: false,
  intervalSec: 5,
};

function storageKey(scope: string) {
  return `unio:refresh-settings:${scope}`;
}

function isIntervalSec(n: unknown): n is RefreshIntervalSec {
  return (
    typeof n === "number" &&
    (REFRESH_INTERVAL_OPTIONS as readonly number[]).includes(n)
  );
}

function readSettings(scope: string, defaults: RefreshSettings): RefreshSettings {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<RefreshSettings>;
    return {
      autoRefresh:
        typeof parsed.autoRefresh === "boolean"
          ? parsed.autoRefresh
          : defaults.autoRefresh,
      intervalSec: isIntervalSec(parsed.intervalSec)
        ? parsed.intervalSec
        : defaults.intervalSec,
    };
  } catch {
    return defaults;
  }
}

function writeSettings(scope: string, next: RefreshSettings) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

/** 列表刷新设置（自动刷新开关 + 间隔），按 scope 写入 localStorage。
 * defaults 覆盖首次（无本地存储时）的默认值；用户改过后以本地存储为准。 */
export function useRefreshSettings(
  scope: string,
  defaults?: Partial<RefreshSettings>,
) {
  const defaultAutoRefresh = defaults?.autoRefresh ?? DEFAULT_SETTINGS.autoRefresh;
  const defaultIntervalSec = defaults?.intervalSec ?? DEFAULT_SETTINGS.intervalSec;
  const resolvedDefaults = useMemo<RefreshSettings>(
    () => ({ autoRefresh: defaultAutoRefresh, intervalSec: defaultIntervalSec }),
    [defaultAutoRefresh, defaultIntervalSec],
  );

  const [settings, setSettings] = useState<RefreshSettings>(() =>
    readSettings(scope, resolvedDefaults),
  );

  useEffect(() => {
    setSettings(readSettings(scope, resolvedDefaults));
  }, [scope, resolvedDefaults]);

  const update = useCallback(
    (patch: Partial<RefreshSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        writeSettings(scope, next);
        return next;
      });
    },
    [scope],
  );

  const setAutoRefresh = useCallback(
    (autoRefresh: boolean) => update({ autoRefresh }),
    [update],
  );

  const setIntervalSec = useCallback(
    (intervalSec: RefreshIntervalSec) => update({ intervalSec }),
    [update],
  );

  return {
    autoRefresh: settings.autoRefresh,
    intervalSec: settings.intervalSec,
    setAutoRefresh,
    setIntervalSec,
  };
}
