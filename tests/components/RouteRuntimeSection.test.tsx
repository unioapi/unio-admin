import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRuntimeSection } from "@/components/routes/RouteRuntimeSection";
import type { RouteRuntime, RouteRuntimeChannel } from "@/lib/api/routesOps";

const mocks = vi.hoisted(() => ({
  getModels: vi.fn(),
  getRuntime: vi.fn(),
  requestsList: vi.fn(),
}));

vi.mock("@/lib/api/routesOps", () => ({
  getRouteOpsReachableModels: mocks.getModels,
  getRouteRuntime: mocks.getRuntime,
}));

vi.mock("@/components/requests/RequestsList", () => ({
  RequestsList: (props: unknown) => {
    mocks.requestsList(props);
    return <div data-testid="scoring-samples">评分样本列表</div>;
  },
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function channelFixture(overrides: Partial<RouteRuntimeChannel> = {}): RouteRuntimeChannel {
  return {
    channel_id: 10,
    channel_name: "primary",
    channel_status: "enabled",
    provider: { id: 1, name: "provider-a", status: "enabled" },
    protocol: "openai",
    adapter_key: "openai",
    priority: 10,
    order: 1,
    eligibility: {
      status: "eligible",
      reasons: [],
      checks: [
        { key: "margin", status: "passed" },
        { key: "provider_breaker", status: "passed" },
        { key: "channel_breaker", status: "passed" },
        { key: "cooldown", status: "passed" },
        { key: "model_permission", status: "passed" },
      ],
    },
    runtime: {
      state: "active",
      config_synchronized: true,
      breaker_store_admission: "normal",
      capacity_read_failed: false,
    },
    concurrency: {
      used: 2,
      limit: 10,
      remaining: 8,
      remaining_pct: 0.8,
      unlimited: false,
      metric_score: 80,
      contribution: 16,
    },
    quality: {
      ttft: {
        has_samples: true,
        value: 1_250,
        sample_count: 5,
        metric_score: 97.5,
        contribution: 24.375,
      },
      error_rate: {
        has_samples: true,
        value: 2,
        sample_count: 8,
        metric_score: 96,
        contribution: 19.2,
      },
    },
    traffic: {
      rpm: 12,
      rpd: 240,
      tpm: 8_000,
      token_covered_attempts: 10,
      token_coverage_pct: 83.3,
    },
    score: {
      algorithm_version: "objective_v1",
      total: 82.575,
      cost_ratio: 0.4,
      priority: 10,
      cost: { metric_score: 60, weight_pct: 25, contribution: 15 },
      concurrency: { metric_score: 80, weight_pct: 20, contribution: 16 },
      ttft: { metric_score: 97.5, weight_pct: 25, contribution: 24.375 },
      error_rate: { metric_score: 96, weight_pct: 20, contribution: 19.2 },
      priority_score: { metric_score: 90, weight_pct: 10, contribution: 9 },
    },
    distribution: {
      selected_1m: 3,
      selected_5m: 12,
      selected_share_1m: 0.75,
      selected_share_5m: 0.6,
      fallback_1m: 1,
    },
    internal_diagnostics: {
      origin_revision: 2,
      runtime_origin_revision: 2,
      provider_status_revision: 3,
      runtime_provider_status_revision: 3,
      channel_config_revision: 7,
      runtime_channel_config_revision: 7,
      channel_capacity_revision: 8,
      runtime_channel_capacity_revision: 8,
      global_concurrency_revision: 9,
      circuit_breaker_revision: 10,
      routing_balance_revision: 11,
      runtime_control_state: "active",
    },
    ...overrides,
  };
}

function runtimeFixture(): RouteRuntime {
  return {
    source_status: {
      state: "active",
      breaker_store_admission: "normal",
      observed_at: "2026-07-30T12:00:00Z",
      stale: false,
      sources: [
        {
          name: "breaker_store",
          available: true,
          observed_at: "2026-07-30T12:00:00Z",
          stale: false,
        },
      ],
    },
    route_summary: {
      route_id: 7,
      mode: "balanced",
      status: "enabled",
      pool_size: 2,
      candidate_count: 1,
      no_redundancy: true,
      all_capacity_full: false,
      usage: { concurrency: 2, rpm: 12, rpd: 240, tpm: 8_000, active_users: 1 },
    },
    filters: { model_id: "openai/gpt-test", protocol: "" },
    channels: [
      channelFixture(),
      channelFixture({
        channel_id: 11,
        channel_name: "excluded",
        order: 2,
        provider: { id: 2, name: "provider-b", status: "disabled" },
        eligibility: {
          status: "excluded",
          primary_reason: "provider_disabled",
          reasons: ["provider_disabled"],
          checks: [
            { key: "provider", status: "failed", reason: "provider_disabled" },
            { key: "margin", status: "passed" },
          ],
        },
        quality: {
          ttft: {
            has_samples: false,
            value: null,
            sample_count: 0,
            metric_score: 100,
            contribution: 25,
          },
          error_rate: {
            has_samples: false,
            value: null,
            sample_count: 0,
            metric_score: 100,
            contribution: 20,
          },
        },
      }),
    ],
    score_config: {
      algorithm_version: "objective_v1",
      revision: 11,
      cost_weight_pct: 25,
      concurrency_weight_pct: 20,
      ttft_weight_pct: 25,
      error_rate_weight_pct: 20,
      priority_weight_pct: 10,
      ttft_penalty_unit_ms: 1_000,
      ttft_penalty_points_per_unit: 2.5,
      error_penalty_points_per_percent: 2,
    },
    sample_window: {
      ttft_window_ms: 1_800_000,
      error_window_ms: 1_800_000,
      started_at: "2026-07-30T11:30:00Z",
      ended_at: "2026-07-30T12:00:00Z",
      available: true,
    },
  };
}

function renderSection() {
  return render(
    <TestProviders>
      <RouteRuntimeSection routeId={7} />
    </TestProviders>,
  );
}

describe("RouteRuntimeSection objective_v1", () => {
  beforeEach(() => {
    mocks.getModels.mockReset();
    mocks.getRuntime.mockReset();
    mocks.requestsList.mockReset();
    mocks.getModels.mockResolvedValue([
      { model_id: "openai/gpt-test", display_name: "GPT Test" },
    ]);
    mocks.getRuntime.mockResolvedValue(runtimeFixture());
  });

  it("renders the fixed ten-column candidate table and removes recent decisions", async () => {
    renderSection();

    expect(await screen.findByText("primary", { exact: true })).toBeVisible();
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(10);
    expect(headers.map((header) => header.textContent)).toEqual([
      "顺序",
      "渠道",
      "资格",
      "运行态",
      "并发",
      "TTFT",
      "流量",
      "得分",
      "分流",
      "操作",
    ]);
    expect(screen.queryByText("最近路由决策")).not.toBeInTheDocument();
    const primary = screen.getByText("primary", { exact: true });
    const row = primary.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("12 RPM")).toBeVisible();
    expect(within(row).getByText("1.25s")).toBeVisible();
    await waitFor(() =>
      expect(mocks.getRuntime).toHaveBeenCalledWith(7, {
        model_id: "openai/gpt-test",
        protocol: undefined,
        sort: "order",
      }),
    );
  });

  it("shows exclusion reasons and treats no TTFT sample as full score", async () => {
    renderSection();
    const excluded = await screen.findByText("excluded", { exact: true });
    const row = excluded.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("无资格")).toBeVisible();
    expect(within(row).getByText("服务商disabled")).toBeVisible();
    expect(within(row).getByText("无样本")).toBeVisible();
  });

  it("explains the five-part score calculation", async () => {
    const user = userEvent.setup();
    renderSection();
    const primary = await screen.findByText("primary", { exact: true });
    const row = primary.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    const score = within(row).getByText("82.58");
    await user.hover(score);
    expect(await screen.findByText("综合得分")).toBeVisible();
    expect(screen.getByText("60 × 25% = 15")).toBeVisible();
    expect(screen.getByText(/15 \+ 16 \+ 24\.38 \+ 19\.2 \+ 9 = 82\.58/)).toBeVisible();
  });

  it("opens a styled channel detail with qualification, traffic and diagnostics", async () => {
    const user = userEvent.setup();
    renderSection();
    const primary = await screen.findByText("primary", { exact: true });
    const row = primary.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    await user.click(within(row).getByRole("button", { name: "查看" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("资格检查")).toBeVisible();
    expect(within(dialog).getByText("五项评分")).toBeVisible();
    expect(within(dialog).getByText("8,000")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "内部诊断" }));
    expect(await within(dialog).findByText("routing_balance_revision")).toBeVisible();
  });

  it("reuses RequestsList with the 30-minute scoring window", async () => {
    renderSection();
    expect(await screen.findByTestId("scoring-samples")).toBeVisible();
    await waitFor(() => expect(mocks.requestsList).toHaveBeenCalled());
    expect(mocks.requestsList.mock.calls.at(-1)?.[0]).toMatchObject({
      fixedRouteId: 7,
      scoringDimension: "any",
      sampleWindow: {
        from: "2026-07-30T11:30:00Z",
        to: "2026-07-30T12:00:00Z",
      },
      showRangeFilter: false,
      showRefreshControl: false,
    });
  });

  it("uses one refresh control for runtime and scoring samples", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByText("primary", { exact: true })).toBeVisible();
    await waitFor(() => {
      expect(mocks.getModels).toHaveBeenCalledTimes(1);
      expect(mocks.getRuntime).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", {
        name: "自动刷新已开启，点击刷新实时路由",
      }),
    );

    await waitFor(() => {
      expect(mocks.getModels).toHaveBeenCalledTimes(2);
      expect(mocks.getRuntime).toHaveBeenCalledTimes(2);
    });
  });
});
