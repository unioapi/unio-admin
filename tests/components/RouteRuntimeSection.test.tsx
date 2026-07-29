import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRuntimeSection } from "@/components/routes/RouteRuntimeSection";
import type { RouteRuntime, RoutingDecision } from "@/lib/api/routesOps";

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
  return (
    <MemoryRouter>
      <NuqsAdapter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NuqsAdapter>
    </MemoryRouter>
  );
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
    rpd_limit: 0,
    rpd_remaining: null,
    global_rpd_used: 120,
    global_rpd_limit: 300,
    global_rpd_remaining: 0.6,
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
    origin_revision: 2,
    provider_status_revision: 3,
    runtime_origin_revision: 2,
    runtime_provider_status_revision: 3,
    pending_origin_revision: null,
    pending_provider_status_revision: null,
    origin_revision_current: true,
    provider_status_revision_current: true,
    provider_state_generation: 4,
    origin_fence_generation: 5,
    status_fence_generation: 6,
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
    provider_breaker_state: "closed" as const,
    provider_open_remaining_ms: null,
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
    route_usage: {
      concurrency: 4,
      rpm: 18,
      rpd: 90,
      tpm: 2500,
      active_users: 2,
    },
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
        provider_id: 1,
        channel_id: 10,
        route_index: 0,
        eligible: true,
        candidate_origin_revision: 2,
        runtime_origin_revision: 2,
        origin_revision_current: true,
        candidate_provider_status_revision: 3,
        runtime_provider_status_revision: 3,
        provider_status_revision_current: true,
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
        provider_breaker_state: "closed",
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
    sampled: true,
    created_at: "2026-07-23T12:00:00Z",
    updated_at: "2026-07-23T12:00:00Z",
  };
}

function objectiveDecisionFixture(): RoutingDecision {
  const decision = legacyDecisionFixture();
  const score = decision.candidate_scores[0];
  return {
    ...decision,
    request_id: "req-objective-trace",
    algorithm_version: "objective_v1",
    candidate_scores: [
      {
        ...score,
        algorithm_version: "objective_v1",
        economic_score: 92,
        health_score: 80,
        capacity_score: 70,
        priority_score: 100,
        final_score: 85.4,
        economic_weight_pct: 45,
        health_weight_pct: 25,
        capacity_weight_pct: 20,
        priority_weight_pct: 10,
      },
    ],
  };
}

async function openChannelDetail(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name, { exact: true });
  const row = cell.closest("tr");
  if (!row) throw new Error(`row for ${name} not found`);
  await userEvent.click(within(row).getByRole("button", { name: "查看详情" }));
  return await screen.findByRole("dialog");
}

describe("RouteRuntimeSection", () => {
  beforeEach(() => {
    mocks.getModels.mockResolvedValue([
      { model_id: "openai/gpt-test", display_name: "GPT Test" },
    ]);
    mocks.getRuntime.mockResolvedValue(runtimeFixture());
    mocks.getDecisions.mockResolvedValue({ items: [], total: 0 });
  });

  it("shows a compact routing table with split capacity headroom and hard exclusions", async () => {
    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("运行态数据已陈旧")).toBeVisible();
    expect(screen.getByText("无冗余")).toBeVisible();
    // 资格列：候选 + 硬排除原因。
    expect(screen.getByText("候选")).toBeVisible();
    expect(screen.getByText("服务商停用")).toBeVisible();
    // 得分与分流已拆列；兼容算法主值只显示最终权重。
    expect(screen.getByRole("columnheader", { name: /得分/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /分流/ })).toBeVisible();
    expect(screen.getByText("0.7200")).toBeVisible();
    expect(screen.getAllByText("3 次 / 1m")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: /同步/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /TTFT/ })).toBeVisible();
    // 四维余量拆列：条后显示 used / limit（两条渠道各一套）；合计卡也会出现同名标签。
    expect(screen.getAllByText("并发").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RPM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RPD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TPM").length).toBeGreaterThan(0);
    expect(screen.getByText("线路实时合计（全用户）")).toBeVisible();
    expect(screen.getAllByText("1 / 10")).toHaveLength(2);
    expect(screen.getAllByText("12 / 60")).toHaveLength(2);
    expect(screen.getAllByText("本线路 30")).toHaveLength(2);
    expect(screen.getAllByText("全局 40%")).toHaveLength(2);
    expect(screen.getAllByText("100 / 1K")).toHaveLength(2);
    // Provider 不再作为渠道单元格的次要文本常驻展示。
    expect(screen.queryByText("provider-a")).not.toBeInTheDocument();
    // 精简后这些细节列不再出现在主表（收进展开区）。
    expect(screen.queryByText("成本占售价 25.0%")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "源站 熔断" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.getRuntime).toHaveBeenCalledWith(7, {
        model_id: "openai/gpt-test",
        protocol: undefined,
        sort: "order",
      }),
    );
  });

  it("reveals runtime facts in the per-channel detail drawer", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    const detail = await openChannelDetail("primary");
    expect(within(detail).getByText("成本占售价")).toBeVisible();
    expect(within(detail).getByText("25.0%")).toBeVisible();
    expect(within(detail).getByText("120ms · 4 样本")).toBeVisible();
    expect(within(detail).getByText("3 秒")).toBeVisible();
    expect(within(detail).getByText("暂停 · 待复检")).toBeVisible();
    expect(within(detail).getByText(/12 \/ 60 · 剩 80\.0%/)).toBeVisible();
  });

  it("reveals channel, score, traffic, sync, and TTFT details on hover", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    Object.assign(runtime.channels[0], {
      algorithm_version: "objective_v1",
      economic_score: 92,
      health_score: 80,
      capacity_score: 70,
      priority_score: 100,
      final_score: 85.4,
      economic_weight_pct: 45,
      health_weight_pct: 25,
      capacity_weight_pct: 20,
      priority_weight_pct: 10,
    });
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    await screen.findByText("primary", { exact: true });
    await userEvent.hover(
      screen.getByRole("button", { name: "查看渠道 primary 详情" }),
    );
    expect(
      (await screen.findAllByText(/provider-a \(#1\)/)).length,
    ).toBeGreaterThan(0);

    await userEvent.hover(
      screen.getByRole("button", { name: "查看得分详情 85.40" }),
    );
    expect(
      (await screen.findAllByText(/总分 = 经济×45%/)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("客观评分 · objective_v1").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("92.00 × 45% = 41.40").length).toBeGreaterThan(
      0,
    );

    await userEvent.hover(
      screen.getAllByRole("button", { name: "查看分流详情 100.0%" })[0],
    );
    expect(
      (await screen.findAllByText("当前线路内的最终命中分布")).length,
    ).toBeGreaterThan(0);

    await userEvent.hover(
      screen.getAllByRole("button", { name: "查看同步详情 运行态已同步" })[0],
    );
    expect(
      (await screen.findAllByText("版本与同步状态")).length,
    ).toBeGreaterThan(0);

    await userEvent.hover(
      screen.getByRole("button", { name: "查看 TTFT 详情 120ms" }),
    );
    expect(
      (await screen.findAllByText("流式首字时间（TTFT）")).length,
    ).toBeGreaterThan(0);
  });

  it("renders route-level usage totals for all users", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("线路实时合计（全用户）")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("18")).toBeVisible();
    expect(screen.getByText("90")).toBeVisible();
    expect(screen.getByText("2.5K")).toBeVisible();

    await userEvent.hover(
      screen.getByRole("button", { name: "线路RPD列说明" }),
    );
    expect(
      (
        await screen.findAllByText(
          /记录 Route 入口事实，不要求等于各 Channel RPD 求和/,
        )
      ).length,
    ).toBeGreaterThan(0);

    await userEvent.hover(
      screen.getByRole("button", { name: "线路TPM列说明" }),
    );
    expect(
      (await screen.findAllByText(/运行中请求先记候选池最大完整输入/))
        .length,
    ).toBeGreaterThan(0);
  });

  it("separates route-channel RPD attribution from global channel capacity", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    const rpdCell = await screen.findAllByRole("button", {
      name: /RPD 当前线路 30 次，渠道全局 120 \/ 300/,
    });
    await userEvent.hover(rpdCell[0]);
    expect(
      (await screen.findAllByText("当前线路归因：30 次")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/渠道全局容量：/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Route 入口与 Channel attempt 分别记录/).length,
    ).toBeGreaterThan(0);
  });

  it("does not invent global RPD capacity when the backend omits new facts", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    delete runtime.channels[0].global_rpd_used;
    delete runtime.channels[0].global_rpd_limit;
    delete runtime.channels[0].global_rpd_remaining;
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    const primary = await screen.findByText("primary", { exact: true });
    const row = primary.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("失败")).toBeVisible();
    expect(within(row).queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("shows route usage unavailable when aggregate is missing", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    runtime.route_usage = null;
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("线路实时合计（全用户）")).toBeVisible();
    expect(screen.getAllByText("事实不可用").length).toBeGreaterThan(0);
  });

  it("hides stale routing facts when BreakerStore admission is denied", async () => {
    const runtime = runtimeFixture();
    runtime.breaker_store_admission = "denied";
    runtime.runtime_sync_state = "store_unavailable";
    runtime.route_usage = null;
    runtime.sources[0] = { ...runtime.sources[0], available: false };
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("基础设施故障，准入已拒绝")).toBeVisible();
    expect(screen.queryByText("权重 0.7200")).not.toBeInTheDocument();
    expect(screen.getByText("线路实时合计（全用户）")).toBeVisible();
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
    expect(within(row).queryByText("0.7200")).not.toBeInTheDocument();
  });

  it("treats a missing Channel runtime revision as no sample", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    runtime.channels[0].runtime_channel_config_revision = null;
    runtime.channels[0].channel_config_revision_current = false;
    runtime.channels[0].channel_breaker_state = null;
    runtime.channels[0].error_rate = null;
    runtime.channels[0].error_samples = 0;
    runtime.channels[0].ttft_ewma_ms = null;
    runtime.channels[0].ttft_samples = 0;
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
    expect(within(row).queryByText("版本不一致")).not.toBeInTheDocument();
    expect(within(row).getByText("0.7200")).toBeVisible();
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

  it("explains that fixed routes expose scores without reordering", async () => {
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

    const detail = await openChannelDetail("primary");
    expect(
      within(detail).getByText("固定策略展示评分事实，但不按分数重排"),
    ).toBeVisible();
    // 成本系数中性 1.0000、成本权重 0.5000 在明细抽屉里分列展示。
    expect(within(detail).getByText("1.0000")).toBeVisible();
    expect(within(detail).getByText("0.5000")).toBeVisible();
  });

  it("keeps the runtime detail usable while an older backend omits cost fields", async () => {
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

    const detail = await openChannelDetail("primary");
    // 成本系数缺省中性 1.0000、成本权重 0.0000、最终权重仍为 0.7200。
    expect(within(detail).getByText("1.0000")).toBeVisible();
    expect(within(detail).getByText("0.0000")).toBeVisible();
    expect(within(detail).getByText("0.7200")).toBeVisible();
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
    await userEvent.click(screen.getByRole("button", { name: "查看路由决策" }));
    const dialog = await screen.findByRole("dialog");
    const transportChain =
      within(dialog).getByText("实际尝试链").nextElementSibling;
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

  it("shows objective scores and configured weights in runtime facts", async () => {
    const runtime = runtimeFixture();
    runtime.observed_at = new Date().toISOString();
    Object.assign(runtime.channels[0], {
      algorithm_version: "objective_v1",
      economic_score: 92,
      health_score: 80,
      capacity_score: 70,
      priority_score: 100,
      final_score: 85.4,
      economic_weight_pct: 45,
      health_weight_pct: 25,
      capacity_weight_pct: 20,
      priority_weight_pct: 10,
    });
    mocks.getRuntime.mockResolvedValue(runtime);

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    expect(await screen.findByText("85.40")).toBeVisible();
    const detail = await openChannelDetail("primary");
    expect(within(detail).getByText("92.00 / 80.00")).toBeVisible();
    expect(within(detail).getByText("70.00 / 100.00")).toBeVisible();
    expect(within(detail).getByText("45% / 25% / 20% / 10%")).toBeVisible();
    expect(within(detail).getByText("85.40")).toBeVisible();
  });

  it("shows objective score dimensions in a routing decision", async () => {
    mocks.getDecisions.mockResolvedValue({
      items: [objectiveDecisionFixture()],
      total: 1,
    });

    render(
      <TestProviders>
        <RouteRuntimeSection routeId={7} />
      </TestProviders>,
    );

    await screen.findByText("req-objective-trace");
    await userEvent.click(screen.getByRole("button", { name: "查看路由决策" }));
    const dialog = await screen.findByRole("dialog");
    const scoreTable = within(dialog)
      .getByRole("columnheader", { name: "总分" })
      .closest("table");
    expect(scoreTable).not.toBeNull();
    if (!scoreTable) return;
    expect(
      within(scoreTable).getByRole("columnheader", { name: "经济" }),
    ).toBeVisible();
    expect(
      within(scoreTable).getByRole("columnheader", { name: "健康" }),
    ).toBeVisible();
    expect(
      within(scoreTable).getByRole("columnheader", { name: "容量" }),
    ).toBeVisible();
    expect(
      within(scoreTable).getByRole("columnheader", { name: "Priority" }),
    ).toBeVisible();
    const scoreRow = within(scoreTable)
      .getByText("primary (#10)")
      .closest("tr");
    expect(scoreRow).not.toBeNull();
    if (!scoreRow) return;
    expect(within(scoreRow).getByText("92.00")).toBeVisible();
    expect(within(scoreRow).getByText("80.00")).toBeVisible();
    expect(within(scoreRow).getByText("70.00")).toBeVisible();
    expect(within(scoreRow).getByText("100.00")).toBeVisible();
    expect(within(scoreRow).getByText("85.40")).toBeVisible();
  });
});
