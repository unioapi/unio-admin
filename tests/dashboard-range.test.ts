import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dashboardRangeKey,
  dashboardRangeQuery,
  previousDashboardRangeQuery,
} from "@/lib/dashboard-range";

describe("dashboard range", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps a stable key while a relative range advances", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T10:00:00Z"));
    const value = { preset: "24h" as const };
    const key = dashboardRangeKey(value, "hour");
    const first = dashboardRangeQuery(value, "hour");

    vi.setSystemTime(new Date("2026-08-02T10:01:00Z"));
    const second = dashboardRangeQuery(value, "hour");

    expect(dashboardRangeKey(value, "hour")).toEqual(key);
    expect(second.to).not.toBe(first.to);
    expect(second.from).not.toBe(first.from);
  });

  it("derives the previous period from the current execution time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T10:00:00Z"));
    const previous = previousDashboardRangeQuery(
      { preset: "24h" },
      "hour",
    );

    expect(previous).toMatchObject({
      from: "2026-07-31T10:00:00.000Z",
      to: "2026-08-01T10:00:00.000Z",
      interval: "hour",
      range: "24h",
    });
  });
});
