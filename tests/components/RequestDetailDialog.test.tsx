import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";
import type { Attempt, RequestDetail } from "@/lib/api/requests";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
}));

vi.mock("@/lib/api/requests", () => ({
  getRequest: mocks.getRequest,
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
    response_started_at: null,
    upstream_total_ms: 2500,
    upstream_ttft_ms: 250,
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
    operation: "chat_completions",
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
    response_started_at: stream ? "2026-07-22T00:00:00.300Z" : null,
    response_completed_at: "2026-07-22T00:00:03Z",
    started_at: "2026-07-22T00:00:00Z",
    completed_at: "2026-07-22T00:00:03Z",
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:03Z",
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

function renderDetail(detail: RequestDetail) {
  mocks.getRequest.mockResolvedValue(detail);
  render(
    <TestProviders>
      <RequestDetailDialog requestId={detail.request_id} open onOpenChange={() => {}} />
    </TestProviders>,
  );
}

describe("RequestDetailDialog upstream timing", () => {
  beforeEach(() => mocks.getRequest.mockReset());

  it("shows transport total time and stream-only upstream TTFT", async () => {
    renderDetail(detailFixture(true, attemptFixture()));

    expect(await screen.findByText(/上游总耗时 2\.50s/)).toBeVisible();
    expect(screen.getByText(/上游 TTFT 250ms/)).toBeVisible();
  });

  it("does not render an upstream TTFT label for a non-stream attempt", async () => {
    const detail = detailFixture(
      false,
      attemptFixture({ upstream_ttft_ms: null }),
    );
    // Legacy rows may contain this timestamp; request mode still owns TTFT eligibility.
    detail.response_started_at = "2026-07-22T00:00:00.300Z";
    renderDetail(detail);

    expect(await screen.findByText(/上游总耗时 2\.50s/)).toBeVisible();
    expect(screen.queryByText(/上游 TTFT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/首字 \(TTFT\)/)).not.toBeInTheDocument();
  });
});
