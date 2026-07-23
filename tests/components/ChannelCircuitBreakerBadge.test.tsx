import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelCircuitBreakerBadge } from "@/components/channels/ChannelCircuitBreakerBadge";
import type { ChannelBreakerSnapshot } from "@/lib/api/channelsOps";

function breakerFixture(
  overrides: Partial<ChannelBreakerSnapshot> = {},
): ChannelBreakerSnapshot {
  return {
    scope: "channel",
    id: 9,
    exists: true,
    state: "closed",
    open_remaining_ms: 0,
    open_level: 0,
    eligible_successes: 18,
    eligible_failures: 2,
    consecutive_failures: 0,
    error_rate: 0.1,
    sample_count: 20,
    ttft_ewma_ms: 240,
    ttft_samples: 4,
    ttft_sample_source: "stream_only",
    observed_at: "2026-07-22T04:00:00.000Z",
    ...overrides,
  };
}

describe("ChannelCircuitBreakerBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a neutral no-sample state instead of assuming closed", () => {
    render(
      <ChannelCircuitBreakerBadge
        runtimeSyncState="active"
        breaker={breakerFixture({ exists: false, sample_count: 0 })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "无熔断运行样本" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /熔断闭合/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the active open breaker and its remaining interval", () => {
    render(
      <ChannelCircuitBreakerBadge
        runtimeSyncState="active"
        breaker={breakerFixture({
          state: "open",
          open_remaining_ms: 12_000,
          open_level: 1,
          consecutive_failures: 3,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "熔断中 · 剩余 0:12" }),
    ).toBeVisible();
  });

  it("hides an old breaker snapshot while BreakerStore is unavailable", () => {
    render(
      <ChannelCircuitBreakerBadge
        runtimeSyncState="store_unavailable"
        breaker={breakerFixture({
          state: "open",
          open_remaining_ms: 12_000,
          open_level: 1,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "运行态基础设施故障" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /熔断中/ }),
    ).not.toBeInTheDocument();
  });
});
