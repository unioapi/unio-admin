import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  rangeBucket,
  rangeParams,
  type RangePreset,
  type RangeValue,
} from "@/lib/range";

// 区间状态 + URL 同步（?range=&from=&to=）+ 稳定的 from/to（避免每次 render 重算导致
// react-query key 抖动）。manual refresh / 切区间 / 轮询时通过 tick 推进。
export function useRangeQuery(defaultPreset: RangePreset = "today") {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tick, setTick] = useState(() => Date.now());

  const preset = (searchParams.get("range") as RangePreset | null) ?? null;
  const fromParam = searchParams.get("from") ?? undefined;
  const toParam = searchParams.get("to") ?? undefined;

  const value: RangeValue = preset
    ? { preset, from: fromParam, to: toParam }
    : { preset: defaultPreset };

  const setRange = useCallback(
    (next: RangeValue) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          sp.set("range", next.preset);
          if (next.preset === "custom" && next.from && next.to) {
            sp.set("from", next.from);
            sp.set("to", next.to);
          } else {
            sp.delete("from");
            sp.delete("to");
          }
          return sp;
        },
        { replace: true },
      );
      setTick(Date.now());
    },
    [setSearchParams],
  );

  const refresh = useCallback(() => setTick(Date.now()), []);

  // tick 进入依赖，使相对区间在刷新时重算 to=now。
  // 故意依赖 value 的原始字段而非整个 value 对象（每次 render 重建会导致 query key 抖动 → 反复 refetch）。
  const params = useMemo(
    () => rangeParams(value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.preset, value.from, value.to, tick],
  );
  const bucket = useMemo(
    () => rangeBucket(value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.preset, value.from, value.to],
  );

  return {
    value,
    setRange,
    params,
    bucket,
    refresh,
    refreshedAt: tick,
  };
}
