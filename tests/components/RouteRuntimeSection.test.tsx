import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRuntimeSection } from "@/components/routes/RouteRuntimeSection";
import type { RouteRuntime } from "@/lib/api/routesOps";

const mocks = vi.hoisted(() => ({
  getModels: vi.fn(),
  getRuntime: vi.fn(),
  getDecisions: vi.fn(),
}));

vi.mock("@/lib/api/routesOps", () => ({
  getRouteOpsReachableModels: mocks.getModels,
  getRouteRuntime: mocks.getRuntime,
  getRouteRoutingDecisions: mocks.getDecisions,
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function runtimeFixture(): RouteRuntime {
  const common = {
    channel_status: "enabled",
    provider_status: "enabled",
    protocol: "openai",
    adapter_key: "openai",
    priority: 0,
    concurrency_used: 1,
    concurrency_limit: 10,
    concurrency_remaining: 0.9,
    tpm_used: 100,
    tpm_limit: 1000,
    tpm_remaining: 0.9,
    capacity_score: 0.9,
    health_factor: 0.8,
    pressure: 0.1,
    capacity_unknown: false,
    capacity_read_failed: false,
    breaker_state: "closed",
    error_rate: 0.01,
    latency_ewma_ms: 120,
    selected_1m: 3,
    selected_5m: 8,
    selected_share_1m: 1,
    selected_share_5m: 1,
    fallback_1m: 0,
    instance_snapshots: [],
  };
  return {
    route_id: 7,
    mode: "balanced",
    route_status: "enabled",
    model_id: "openai/gpt-test",
    observed_at: new Date(Date.now() - 11_000).toISOString(),
    stale: false,
    pool_size: 2,
    candidate_count: 1,
    no_redundancy: true,
    all_capacity_zero: false,
    capacity_degraded: false,
    sources: [{ name: "redis", available: true, observed_at: new Date().toISOString(), stale: false }],
    gateway_sources: [{ id: "gateway-1", available: true, observed_at: new Date().toISOString() }],
    channels: [
      {
        ...common,
        channel_id: 10,
        channel_name: "primary",
        provider_id: 1,
        provider_name: "provider-a",
        eligible: true,
        current_order: 1,
        final_weight: 0.72,
        margin_status: "safe",
      },
      {
        ...common,
        channel_id: 11,
        channel_name: "excluded",
        provider_id: 2,
        provider_name: "provider-b",
        provider_status: "disabled",
        eligible: false,
        excluded_reason: "provider_disabled",
        current_order: 0,
        final_weight: 0,
        margin_status: "not_evaluated",
      },
    ],
  };
}

describe("RouteRuntimeSection", () => {
  beforeEach(() => {
    mocks.getModels.mockResolvedValue([
      { model_id: "openai/gpt-test", display_name: "GPT Test" },
    ]);
    mocks.getRuntime.mockResolvedValue(runtimeFixture());
    mocks.getDecisions.mockResolvedValue({ items: [], total: 0 });
  });

  it("marks observations older than ten seconds stale and shows hard exclusions", async () => {
    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("运行态数据已陈旧")).toBeVisible();
    expect(screen.getByText("无冗余")).toBeVisible();
    expect(screen.getByText("服务商停用")).toBeVisible();
    expect(screen.getByText("权重 0.7200")).toBeVisible();
    await waitFor(() =>
      expect(mocks.getRuntime).toHaveBeenCalledWith(7, {
        model_id: "openai/gpt-test",
        protocol: undefined,
      }),
    );
  });
});
