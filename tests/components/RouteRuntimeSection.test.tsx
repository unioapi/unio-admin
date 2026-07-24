import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRuntimeSection } from "@/components/routes/RouteRuntimeSection";
import type {
  RouteRuntime,
  RoutingDecision,
} from "@/lib/api/routesOps";

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
    rpm_used: 12,
    rpm_limit: 60,
    rpm_remaining: 0.8,
    rpd_used: 30,
    rpd_limit: 300,
    rpd_remaining: 0.9,
    tpm_used: 100,
    tpm_limit: 1000,
    tpm_remaining: 0.9,
    capacity_score: 0.9,
    cost_ratio: 0.25,
    cost_weight: 0.5,
    cost_factor: 0.875,
    pressure: 0.1,
    capacity_unknown: false,
    capacity_read_failed: false,
    provider_origin_id: 21,
    provider_origin_name: "primary-endpoint",
    provider_origin_status: "enabled",
    origin_base_url_revision: 2,
    origin_status_revision: 3,
    runtime_origin_base_url_revision: 2,
    runtime_origin_status_revision: 3,
    pending_origin_base_url_revision: null,
    pending_origin_status_revision: null,
    origin_base_url_revision_current: true,
    origin_status_revision_current: true,
    origin_state_generation: 4,
    origin_base_url_fence_generation: 5,
    origin_status_fence_generation: 6,
    channel_config_revision: 7,
    runtime_channel_config_revision: 7,
    channel_config_revision_current: true,
    channel_admission_limits_revision: 8,
    runtime_channel_admission_limits_revision: 8,
    channel_admission_limits_revision_current: true,
    route_rate_limits_revision: 9,
    channel_rate_limits_revision: 13,
    global_concurrency_revision: 10,
    circuit_breaker_revision: 11,
    routing_balance_revision: 12,
    runtime_control_state: "active" as const,
    runtime_revision_current: true,
    origin_breaker_state: "closed" as const,
    origin_open_remaining_ms: null,
    channel_breaker_state: "closed" as const,
    channel_open_remaining_ms: null,
    error_rate: 0.01,
    error_samples: 20,
    ttft_ewma_ms: 120,
    ttft_samples: 4,
    ttft_sample_source: "stream_only" as const,
    cooldown_remaining_ms: 2_500,
    model_permission_paused: true,
    model_permission_recheck_state: "queued",
    runtime_sync_state: "active" as const,
    breaker_store_admission: "normal" as const,
    selected_1m: 3,
    selected_5m: 8,
    selected_share_1m: 1,
    selected_share_5m: 1,
    fallback_1m: 0,
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
    runtime_sync_state: "active",
    breaker_store_admission: "normal",
    sources: [
      {
        name: "redis",
        available: true,
        observed_at: new Date().toISOString(),
        stale: false,
      },
    ],
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
        cost_ratio: null,
        cost_factor: 1,
        ttft_ewma_ms: null,
        ttft_samples: 0,
        margin_status: "negative_margin",
      },
    ],
  };
}

function legacyDecisionFixture(): RoutingDecision {
  return {
    id: 1,
    request_record_id: 101,
    request_id: "req-old-trace",
    request_status: "succeeded",
    route_id: 7,
    mode: "balanced",
    requested_model_id: "openai/gpt-test",
    protocol: "openai",
    endpoint: "chat.completions",
    pool_size: 1,
    candidate_count: 1,
    sticky_channel_id: null,
    sticky_pinned: false,
    sticky_invalid: false,
    all_capacity_zero: false,
    margin_guard_triggered: false,
    abnormal: false,
    abnormal_reasons: [],
    candidate_scores: [
      {
        origin_id: 21,
        channel_id: 10,
        route_index: 0,
        eligible: true,
        candidate_origin_base_url_revision: 2,
        runtime_origin_base_url_revision: 2,
        origin_base_url_revision_current: true,
        candidate_origin_status_revision: 3,
        runtime_origin_status_revision: 3,
        origin_status_revision_current: true,
        candidate_channel_config_revision: 7,
        runtime_channel_config_revision: 7,
        channel_config_revision_current: true,
        candidate_channel_admission_limits_revision: 8,
        runtime_channel_admission_limits_revision: 8,
        channel_admission_limits_revision_current: true,
        route_rate_limits_revision: 9,
        channel_rate_limits_revision: 13,
        global_concurrency_revision: 10,
        circuit_breaker_revision: 11,
        routing_balance_revision: 12,
        runtime_control_state: "active",
        runtime_revision_current: true,
        origin_breaker_state: "closed",
        channel_breaker_state: "closed",
        breaker_store_admission: "normal",
        concurrency_remaining: 0.9,
        tpm_remaining: 0.9,
        capacity_score: 0.9,
        error_rate: 0.01,
        error_samples: 20,
        ttft_ewma_ms: 120,
        ttft_samples: 4,
        ttft_sample_source: "stream_only",
        latency_penalty: 1,
        routing_factor: 1,
        final_weight: 0.72,
        pressure: 0.1,
        capacity_unknown: false,
        capacity_read_failed: false,
        cooldown_remaining_ms: 0,
        model_permission_paused: false,
        model_permission_recheck_state: "cleared",
      },
    ],
    selected_order: [10],
    fallback_chain: [
      { channel_id: 10, upstream_endpoint: "responses_compact" },
      { channel_id: 10, upstream_endpoint: "chat_completions" },
    ],
    final_channel_id: 10,
    algorithm_version: "p4-balanced-v1",
    sampled: true,
    created_at: "2026-07-23T12:00:00Z",
    updated_at: "2026-07-23T12:00:00Z",
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
    expect(screen.getByText("最终权重 0.7200")).toBeVisible();
    expect(screen.getByText("成本占售价 25.0%")).toBeVisible();
    expect(
      screen.getByText("成本系数 0.8750 · 成本权重 0.5000"),
    ).toBeVisible();
    expect(screen.getByText("毛利 负毛利")).toBeVisible();
    expect(screen.getAllByText("primary-endpoint")).toHaveLength(2);
    expect(screen.getByText("120ms")).toBeVisible();
    expect(screen.getByText("4 个流式样本")).toBeVisible();
    expect(screen.getAllByText("429 冷却 3 秒")).toHaveLength(2);
    expect(screen.getAllByText("权限暂停 · 待复检")).toHaveLength(2);
    expect(screen.getAllByText(/RPM 12 \/ 60 · 剩余 80\.0%/)).toHaveLength(2);
    expect(screen.getAllByText(/RPD 30 \/ 300 · 剩余 90\.0%/)).toHaveLength(2);
    expect(
      screen.getAllByText("默认限流 线路 r9 · 渠道 r13", { exact: true }),
    ).toHaveLength(2);
    expect(
      screen.getAllByText("控制 并发 r10 · 熔断 r11 · 均衡 r12", {
        exact: true,
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("columnheader", { name: "源站 熔断" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "渠道熔断" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(mocks.getRuntime).toHaveBeenCalledWith(7, {
        model_id: "openai/gpt-test",
        protocol: undefined,
      }),
    );
  });

  it("hides stale routing facts when BreakerStore admission is denied", async () => {
    const runtime = runtimeFixture();
    runtime.breaker_store_admission = "denied";
    runtime.runtime_sync_state = "store_unavailable";
    runtime.sources[0] = { ...runtime.sources[0], available: false };
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("基础设施故障，准入已拒绝")).toBeVisible();
    expect(screen.queryByText("最终权重 0.7200")).not.toBeInTheDocument();
    expect(screen.queryByText("120ms")).not.toBeInTheDocument();
  });

  it("hides facts from a mismatched runtime revision", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    runtime.channels[0].channel_config_revision = 8;
    runtime.channels[0].channel_config_revision_current = false;
    runtime.channels[0].runtime_revision_current = false;
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    const channelName = await screen.findByText("primary", { exact: true });
    const row = channelName.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("版本不一致")).toBeVisible();
    expect(within(row).getByText(/渠道 r8\/r7/)).toBeVisible();
    expect(within(row).queryByText("最终权重 0.7200")).not.toBeInTheDocument();
    expect(within(row).queryByText("120ms")).not.toBeInTheDocument();
  });

  it("labels invalid pricing exclusions in Chinese", async () => {
    const runtime = runtimeFixture();
    runtime.channels[1].excluded_reason = "pricing_invalid";
    runtime.channels[1].margin_status = "pricing_invalid";
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("价格配置无效")).toBeVisible();
    expect(screen.getByText("毛利 价格无效")).toBeVisible();
  });

  it("makes the cost factor neutral and explicit for fixed routes", async () => {
    const runtime = runtimeFixture();
    runtime.mode = "fixed";
    runtime.observed_at = new Date().toISOString();
    for (const channel of runtime.channels) channel.cost_factor = 1;
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(
      await screen.findAllByText("固定策略不参与成本排序"),
    ).toHaveLength(2);
    expect(
      screen.getAllByText("成本系数 1.0000 · 成本权重 0.5000"),
    ).toHaveLength(2);
  });

  it("keeps the runtime table usable while an older backend omits cost fields", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    delete runtime.channels[0].cost_ratio;
    delete runtime.channels[0].cost_weight;
    delete runtime.channels[0].cost_factor;
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    const channelName = await screen.findByText("primary", { exact: true });
    const row = channelName.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("—")).toBeVisible();
    expect(
      within(row).getByText("成本系数 1.0000 · 成本权重 0.0000"),
    ).toBeVisible();
    expect(within(row).getByText("最终权重 0.7200")).toBeVisible();
  });

  it("uses neutral cost defaults when an older routing trace has no cost fields", async () => {
    mocks.getDecisions.mockResolvedValue({
      items: [legacyDecisionFixture()],
      total: 1,
    });

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    await screen.findByText("req-old-trace");
    await userEvent.click(
      screen.getByRole("button", { name: "查看路由决策" }),
    );
    const dialog = await screen.findByRole("dialog");
    const transportChain = within(dialog).getByText("实际尝试链")
      .nextElementSibling;
    expect(transportChain).toHaveTextContent(
      "primary (#10) · Responses Compact",
    );
    expect(transportChain).toHaveTextContent(
      "primary (#10) · Chat Completions",
    );
    const scoreTable = within(dialog)
      .getByRole("columnheader", { name: "成本占比" })
      .closest("table");
    expect(scoreTable).not.toBeNull();
    if (!scoreTable) return;
    const scoreLabel = within(scoreTable).getByText("primary (#10)");
    const scoreRow = scoreLabel.closest("tr");
    expect(scoreRow).not.toBeNull();
    if (!scoreRow) return;
    expect(within(scoreRow).getByText("—")).toBeVisible();
    expect(within(scoreRow).getByText("0.0000")).toBeVisible();
    expect(within(scoreRow).getByText("1.0000")).toBeVisible();
  });
});
