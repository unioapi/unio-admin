import type { RangeQuery, TimeseriesInterval } from "@/lib/api/dashboard";
import {
  previousPeriodParams,
  rangeParams,
  type RangeValue,
} from "@/lib/range";

export function dashboardRangeKey(
  value: RangeValue,
  interval: TimeseriesInterval,
) {
  return {
    preset: value.preset,
    from: value.preset === "custom" ? value.from : undefined,
    to: value.preset === "custom" ? value.to : undefined,
    interval,
  };
}

export function dashboardRangeQuery(
  value: RangeValue,
  interval: TimeseriesInterval,
): RangeQuery {
  return {
    ...rangeParams(value),
    range: value.preset,
    interval,
  };
}

export function previousDashboardRangeQuery(
  value: RangeValue,
  interval: TimeseriesInterval,
): RangeQuery | null {
  const current = dashboardRangeQuery(value, interval);
  const previous = previousPeriodParams(current);
  if (!previous) return null;
  return { ...current, ...previous };
}
