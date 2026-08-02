import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestListItem } from "@/lib/api/requests";

const mocks = vi.hoisted(() => ({
  listRequests: vi.fn(),
}));

vi.mock("@/lib/api/requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/requests")>();
  return { ...actual, listRequests: mocks.listRequests };
});

import { RequestsList } from "@/components/requests/RequestsList";

function renderRequests(client: QueryClient, initialEntry = "/requests") {
  window.history.pushState({}, "", initialEntry);
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <NuqsAdapter>
          <RequestsList />
        </NuqsAdapter>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function richRequest(sequence: number): RequestListItem {
  const timestamp = new Date(Date.now()).toISOString();
  return {
    id: sequence,
    request_id: `req_refresh_${sequence}`,
    user_id: 7,
    api_key_id: 11,
    requested_model_id: "claude-sonnet-4-5",
    ingress_protocol: "openai",
    endpoint: "responses",
    response_model_id: "claude-sonnet-4-5-20250929",
    response_protocol: "anthropic",
    response_id: `resp_${sequence}`,
    stream: true,
    status: "succeeded",
    final_provider_id: 3,
    final_channel_id: 5,
    error_code: null,
    error_message: null,
    delivery_status: "completed",
    gateway_first_token_at: timestamp,
    response_completed_at: timestamp,
    started_at: timestamp,
    completed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    uncached_input_tokens: 12_345,
    cache_read_input_tokens: 3_456,
    cache_write_5m_input_tokens: 789,
    cache_write_1h_input_tokens: 0,
    cache_write_30m_input_tokens: 0,
    output_tokens: 2_048,
    reasoning_output_tokens: 512,
    user_charge_usd: "0.183421",
    total_cost_usd: "0.104512",
    uncached_input_cost_usd: "0.037035",
    cache_read_input_cost_usd: "0.001037",
    cache_write_5m_input_cost_usd: "0.002958",
    cache_write_1h_input_cost_usd: null,
    cache_write_30m_input_cost_usd: null,
    output_cost_usd: "0.061440",
    reasoning_output_cost_usd: "0.015360",
    uncached_input_cost_unit_usd: "3.000000",
    cache_read_input_cost_unit_usd: "0.300000",
    cache_write_5m_input_cost_unit_usd: "3.750000",
    cache_write_1h_input_cost_unit_usd: null,
    cache_write_30m_input_cost_unit_usd: null,
    output_cost_unit_usd: "30.000000",
    reasoning_output_cost_unit_usd: "30.000000",
    uncached_input_price_unit_usd: "4.500000",
    cache_read_input_price_unit_usd: "0.450000",
    cache_write_5m_input_price_unit_usd: "5.625000",
    cache_write_1h_input_price_unit_usd: null,
    cache_write_30m_input_price_unit_usd: null,
    output_price_unit_usd: "45.000000",
    reasoning_output_price_unit_usd: "45.000000",
    channel_cost_multiplier: "1.000000",
    recharge_factor: "1.000000",
    long_context_applied: false,
    api_key_name: "soak-test-key",
    api_key_prefix: "sk-test",
    api_key_plaintext: null,
    route_name: "primary-route",
    route_id: 2,
    route_price_ratio: "1.500000",
    route_mode: "priority",
    final_channel_name: "anthropic-primary",
    channel_chain: "anthropic-primary -> anthropic-fallback",
    scoring_attempt_id: 101,
    scoring_dimensions: ["ttft", "error"],
    scoring_error_failure: false,
    model_display_name: "Claude Sonnet 4.5",
    model_owned_by: "Anthropic",
    reasoning_effort: "medium",
    reasoning_budget_tokens: 2_048,
    client_ip: "192.0.2.10",
    latency_ms: 3_200,
    gateway_ttft_ms: 420,
    tps: 87.5,
    sticky_key_present: true,
    sticky_action: "kept",
    sticky_reason: "preferred_channel_available",
    sticky_before_channel_id: 5,
    sticky_after_channel_id: 5,
    sticky_pinned: true,
    sticky_pinned_non_preferred: false,
    sticky_before_channel_name: "anthropic-primary",
    sticky_after_channel_name: "anthropic-primary",
  };
}

describe("RequestsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.listRequests.mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("keeps one rich-response cache entry through 300 auto-refreshes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T10:00:00Z"));
    localStorage.setItem(
      "unio:refresh-settings:requests:list",
      JSON.stringify({ autoRefresh: true, intervalSec: 1 }),
    );
    let sequence = 0;
    mocks.listRequests.mockImplementation(() => {
      sequence += 1;
      return Promise.resolve({ items: [richRequest(sequence)], total: 1 });
    });
    const client = createClient();
    const view = renderRequests(client);

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_100);
    });

    expect(mocks.listRequests).toHaveBeenCalledTimes(301);
    const requestQueries = client
      .getQueryCache()
      .getAll()
      .filter((query) => query.queryKey[0] === "requests");
    expect(requestQueries).toHaveLength(1);
    expect(requestQueries[0]?.state.data).toMatchObject({
      items: [{ id: 301, request_id: "req_refresh_301" }],
      total: 1,
    });

    const firstRange = mocks.listRequests.mock.calls[0]?.[0];
    const lastRange = mocks.listRequests.mock.calls.at(-1)?.[0];
    expect(lastRange.to).not.toBe(firstRange.to);
    expect(
      new Set(mocks.listRequests.mock.calls.map(([params]) => params.to)).size,
    ).toBe(301);
    view.unmount();
  }, 15_000);

  it("does not overlap auto-refresh while the current request is pending", async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      "unio:refresh-settings:requests:list",
      JSON.stringify({ autoRefresh: true, intervalSec: 1 }),
    );
    let resolveRequest: ((value: { items: never[]; total: number }) => void) | undefined;
    mocks.listRequests.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const client = createClient();
    const view = renderRequests(client);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.listRequests).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(mocks.listRequests).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.({ items: [], total: 0 });
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(mocks.listRequests).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("aborts the in-flight list request when the component unmounts", async () => {
    let requestSignal: AbortSignal | undefined;
    mocks.listRequests.mockImplementation(
      (_params: unknown, signal: AbortSignal) => {
        requestSignal = signal;
        return new Promise(() => {});
      },
    );

    const view = renderRequests(createClient());
    await waitFor(() => expect(requestSignal).toBeInstanceOf(AbortSignal));
    expect(requestSignal?.aborted).toBe(false);

    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("preserves punctuation and spaces in text filters restored from the URL", async () => {
    const client = createClient();
    renderRequests(
      client,
      "/requests?request_id=req_abc-123&model=claude%20sonnet",
    );

    await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
    expect(mocks.listRequests.mock.calls.at(-1)?.[0]).toMatchObject({
      requestId: "req_abc-123",
      model: "claude sonnet",
    });
    expect(await screen.findByPlaceholderText("请求 ID")).toHaveValue(
      "req_abc-123",
    );
    expect(await screen.findByPlaceholderText("按模型筛选")).toHaveValue(
      "claude sonnet",
    );
  });
});
