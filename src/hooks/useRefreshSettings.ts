import { useCallback, useEffect, useState } from "react";

export const REFRESH_INTERVAL_OPTIONS = [2, 5, 10, 15, 30, 60] as const;
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

function readSettings(scope: string): RefreshSettings {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<RefreshSettings>;
    return {
      autoRefresh: Boolean(parsed.autoRefresh),
      intervalSec: isIntervalSec(parsed.intervalSec)
        ? parsed.intervalSec
        : DEFAULT_SETTINGS.intervalSec,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(scope: string, next: RefreshSettings) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

/** 列表刷新设置（自动刷新开关 + 间隔），按 scope 写入 localStorage。 */
export function useRefreshSettings(scope: string) {
  const [settings, setSettings] = useState<RefreshSettings>(() =>
    readSettings(scope),
  );

  useEffect(() => {
    setSettings(readSettings(scope));
  }, [scope]);

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
