import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";
import type { Attempt, RequestDetail } from "@/lib/api/requests";
import type { RoutingDecision } from "@/lib/api/routesOps";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  getRequestRoutingDecision: vi.fn(),
}));

vi.mock("@/lib/api/requests", () => ({
  getRequest: mocks.getRequest,
  getRequestRoutingDecision: mocks.getRequestRoutingDecision,
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function attemptFixture(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 10,
    attempt_index: 0,
    provider_id: 2,
    channel_id: 4,
    adapter_key: "openai",
    upstream_model: "gpt-test",
    upstream_protocol: "openai",
    upstream_response_id: null,
    upstream_response_model: null,
    upstream_finish_reason: "stop",
    finish_class: "stop",
    status: "succeeded",
    fault_party: null,
    upstream_status_code: 200,
    upstream_request_id: null,
    error_code: null,
    error_message: null,
    gateway_first_token_at: null,
    upstream_total_ms: 2500,
    upstream_ttft_ms: 250,
    upstream_timeout_phase: null,
    ttft_scoring_sample: true,
    error_scoring_sample: true,
    error_scoring_failure: false,
    final_usage_received: true,
    started_at: "2026-07-22T00:00:00Z",
    completed_at: "2026-07-22T00:00:03Z",
    created_at: "2026-07-22T00:00:00Z",
    ...overrides,
  };
}

function detailFixture(stream: boolean, attempt: Attempt): RequestDetail {
  return {
    id: 1,
    request_id: stream ? "req_stream" : "req_non_stream",
    user_id: 7,
    api_key_id: 9,
    requested_model_id: "gpt-test",
    ingress_protocol: "openai",
    endpoint: "chat_completions",
    response_model_id: "gpt-test",
    response_protocol: "openai",
    response_id: null,
    stream,
    status: "succeeded",
    final_provider_id: 2,
    final_channel_id: 4,
    error_code: null,
    error_message: null,
    delivery_status: "completed",
    gateway_first_token_at: stream ? "2026-07-22T00:00:00.300Z" : null,
    response_completed_at: "2026-07-22T00:00:03Z",
    started_at: "2026-07-22T00:00:00Z",
    completed_at: "2026-07-22T00:00:03Z",
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:03Z",
    latency_ms: 3000,
    gateway_ttft_ms: stream ? 300 : null,
    tps: stream ? 5.93 : null,
    route_id: null,
    reasoning_effort: null,
    reasoning_budget_tokens: null,
    client_ip: null,
    cost_snapshot: null,
    price_snapshot: null,
    route_price_ratio: null,
    route_mode: null,
    attempts: [attempt],
    usage: null,
    ledger_entries: [],
    billing_exception: null,
  };
}

function routingDecisionFixture(): RoutingDecision {
  return {
    id: 20,
    request_record_id: 1,
    request_id: "req_stream",
    request_status: "succeeded",
    route_id: 3,
    mode: "balanced",
    requested_model_id: "gpt-test",
    protocol: "openai",
    endpoint: "chat_completions",
    trace_status: "complete",
    schema_version: 1,
    algorithm_version: "objective_v1",
    summary: {
      pool_size: 2,
      eligible_count: 1,
      baseline_order: [4],
      actual_scan_order: [4],
      attempted_channel_ids: [4],
      selected_channel_id: 4,
      final_channel_id: 4,
      fallback_count: 0,
      final_result: "success",
      sticky_key_present: true,
      sticky_before_channel_id: 4,
      sticky_before_version: 7,
      sticky_action: "refresh_if_current",
      sticky_reason: "success",
      sticky_after_channel_id: 4,
      sticky_after_version: 7,
      capacity_wait_ms: 85,
      capacity_wait_result: "acquired",
    },
    process: {
      schema_version: 1,
      algorithm_version: "objective_v1",
      mode: "balanced",
      candidates: [
        {
          provider_id: 2,
          channel_id: 4,
          route_index: 0,
          eligible: true,
          candidate_origin_revision: 2,
          runtime_origin_revision: 2,
          origin_revision_current: true,
          candidate_provider_status_revision: 3,
          runtime_provider_status_revision: 3,
          provider_status_revision_current: true,
          candidate_channel_config_revision: 4,
          runtime_channel_config_revision: 4,
          channel_config_revision_current: true,
          candidate_channel_capacity_revision: 5,
          runtime_channel_capacity_revision: 5,
          channel_capacity_revision_current: true,
          route_rate_limits_revision: 6,
          global_concurrency_revision: 7,
          circuit_breaker_revision: 8,
          routing_balance_revision: 9,
          runtime_control_state: "active",
          runtime_revision_current: true,
          provider_breaker_state: "closed",
          channel_breaker_state: "closed",
          breaker_store_admission: "normal",
          concurrency_remaining: 8,
          algorithm_version: "objective_v1",
          cost_score: 60,
          concurrency_score: 80,
          ttft_score: 97.5,
          error_score: 96,
          priority_score: 90,
          final_score: 82.58,
          cost_weight_pct: 25,
          concurrency_weight_pct: 20,
          ttft_weight_pct: 25,
          error_rate_weight_pct: 20,
          priority_weight_pct: 10,
          cost_ratio: 0.4,
          priority: 10,
          avg_ttft_ms: 1_000,
          ttft_sample_count: 5,
          error_rate_pct: 2,
          error_sample_count: 8,
          capacity_unknown: false,
          capacity_read_failed: false,
          cooldown_remaining_ms: 0,
          model_permission_paused: false,
          model_permission_recheck_state: "not_needed",
        },
        {
          provider_id: 3,
          channel_id: 5,
          route_index: 1,
          eligible: false,
          excluded_reason: "protocol_mismatch",
          candidate_origin_revision: 1,
          runtime_origin_revision: 0,
          origin_revision_current: false,
          candidate_provider_status_revision: 1,
          runtime_provider_status_revision: 0,
          provider_status_revision_current: false,
          candidate_channel_config_revision: 1,
          runtime_channel_config_revision: null,
          channel_config_revision_current: false,
          candidate_channel_capacity_revision: 1,
          runtime_channel_capacity_revision: 0,
          channel_capacity_revision_current: false,
          route_rate_limits_revision: 0,
          global_concurrency_revision: 0,
          circuit_breaker_revision: 0,
          routing_balance_revision: 0,
          runtime_control_state: "",
          runtime_revision_current: false,
          breaker_store_admission: "",
          concurrency_remaining: null,
          algorithm_version: "",
          cost_score: 0,
          concurrency_score: 0,
          ttft_score: 0,
          error_score: 0,
          priority_score: 0,
          final_score: 0,
          cost_weight_pct: 0,
          concurrency_weight_pct: 0,
          ttft_weight_pct: 0,
          error_rate_weight_pct: 0,
          priority_weight_pct: 0,
          cost_ratio: 0,
          priority: 0,
          avg_ttft_ms: 0,
          ttft_sample_count: 0,
          error_rate_pct: 0,
          error_sample_count: 0,
          capacity_unknown: false,
          capacity_read_failed: false,
          cooldown_remaining_ms: 0,
          model_permission_paused: false,
          model_permission_recheck_state: "",
        },
      ],
      baseline_order: [4],
      actual_scan_order: [4],
      acquire_results: [{ pass: 0, channel_id: 4, admitted: true }],
      attempts: [{ channel_id: 4, upstream_endpoint: "https://api.example.test/v1" }],
      attempted_channel_ids: [4],
      sticky: {
        key_present: true,
        before_channel_id: 4,
        before_version: 7,
        action: "refresh_if_current",
        reason: "success",
        after_channel_id: 4,
        after_version: 7,
        pinned: true,
        pinned_non_preferred: false,
      },
      capacity_wait: { entered: true, waited_ms: 85, result: "acquired" },
      score_config: {
        routing_balance_revision: 9,
        cost_weight_pct: 25,
        concurrency_weight_pct: 20,
        ttft_weight_pct: 25,
        error_rate_weight_pct: 20,
        priority_weight_pct: 10,
      },
      abnormal_reasons: [],
      final_result: "success",
    },
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:03Z",
  };
}

function renderDetail(detail: RequestDetail) {
  mocks.getRequest.mockResolvedValue(detail);
  render(
    <TestProviders>
      <RequestDetailDialog requestId={detail.request_id} open onOpenChange={() => {}} />
    </TestProviders>,
  );
}

describe("RequestDetailDialog upstream timing", () => {
  beforeEach(() => {
    mocks.getRequest.mockReset();
    mocks.getRequestRoutingDecision.mockReset();
  });

  it("shows transport total time and stream-only upstream TTFT", async () => {
    renderDetail(detailFixture(true, attemptFixture()));

    expect(await screen.findByText(/上游总耗时 2\.50s/)).toBeVisible();
    expect(screen.getByText(/上游 TTFT 250ms/)).toBeVisible();
  });

	  it("uses authoritative millisecond timing fields instead of reparsing display timestamps", async () => {
	    const detail = detailFixture(true, attemptFixture());
	    detail.gateway_first_token_at = "2026-07-22T00:00:01Z";
	    detail.gateway_ttft_ms = 1957;
	    detail.latency_ms = 2250;
	    renderDetail(detail);

	    expect(await screen.findByText("Gateway TTFT")).toBeVisible();
	    expect(screen.getByText("1.96s")).toBeVisible();
	    expect(screen.getByText("2.25s")).toBeVisible();
	  });

  it("does not render an upstream TTFT label for a non-stream attempt", async () => {
    const detail = detailFixture(
      false,
      attemptFixture({ upstream_ttft_ms: null }),
    );
    // Legacy rows may contain this timestamp; request mode still owns TTFT eligibility.
    detail.gateway_first_token_at = "2026-07-22T00:00:00.300Z";
    renderDetail(detail);

    expect(await screen.findByText(/上游总耗时 2\.50s/)).toBeVisible();
    expect(screen.queryByText(/上游 TTFT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gateway TTFT/)).not.toBeInTheDocument();
  });

  it("hides the internal-error toggle when the request has no errors", async () => {
    renderDetail(detailFixture(true, attemptFixture()));

    expect(await screen.findByText(/上游尝试/)).toBeVisible();
    expect(screen.queryByLabelText("显示内部错误")).not.toBeInTheDocument();
  });

  it("shows a concise internal-error toggle beside upstream attempts when failed", async () => {
    renderDetail(
      detailFixture(
        true,
        attemptFixture({
          status: "failed",
          error_code: "upstream_error",
          error_message: "boom",
          upstream_status_code: 500,
        }),
      ),
    );

    expect(await screen.findByLabelText("显示内部错误")).toBeVisible();
    expect(screen.getByText("内部错误")).toBeVisible();
    expect(screen.queryByText(/仅排查用/)).not.toBeInTheDocument();
  });

  it("shows the complete routing trace in a dedicated tab", async () => {
    const user = userEvent.setup();
    const detail = detailFixture(
      true,
      attemptFixture({ upstream_timeout_phase: "first_token" }),
    );
    mocks.getRequestRoutingDecision.mockResolvedValue(routingDecisionFixture());
    renderDetail(detail);

    await user.click(await screen.findByRole("tab", { name: "路由过程" }));

    expect(await screen.findByText("请求成功")).toBeVisible();
    expect(screen.getByText("候选资格")).toBeVisible();
    expect(screen.getByText("五项评分")).toBeVisible();
    expect(screen.getAllByText("命中").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("续期").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("重扫取得容量")).toBeVisible();
    expect(screen.getByText("等待流式首个有效事件")).toBeVisible();
    expect(mocks.getRequestRoutingDecision).toHaveBeenCalledWith(
      "req_stream",
      expect.any(AbortSignal),
    );
  });

  it("distinguishes hard-filtered candidates from stale runtime state", async () => {
    const user = userEvent.setup();
    mocks.getRequestRoutingDecision.mockResolvedValue(routingDecisionFixture());
    renderDetail(detailFixture(true, attemptFixture()));

    await user.click(await screen.findByRole("tab", { name: "路由过程" }));

    expect(await screen.findByText("未评分：protocol_mismatch")).toBeVisible();
    expect(screen.getAllByText("未检查").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("版本落后")).not.toBeInTheDocument();
  });
});
