import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderOriginsSection } from "@/components/providers/ProviderOriginsSection";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getRuntime: vi.fn(),
  list: vi.fn(),
  reset: vi.fn(),
  updateBaseURL: vi.fn(),
  updateName: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock("@/lib/api/providerOrigins", () => ({
  createProviderOrigin: mocks.create,
  getProviderOriginRuntime: mocks.getRuntime,
  listProviderOrigins: mocks.list,
  resetProviderOriginBreaker: mocks.reset,
  updateProviderOriginBaseURL: mocks.updateBaseURL,
  updateProviderOriginName: mocks.updateName,
  updateProviderOriginStatus: mocks.updateStatus,
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const endpoint = {
  id: 7,
  provider_id: 3,
  provider_name: "Provider A",
  name: "primary",
  base_url: "https://api.example.test/v1",
  base_url_revision: 2,
  status: "enabled" as const,
  status_revision: 4,
  channel_count: 1,
  runtime_sync_pending: true,
  runtime_sync_state: "runtime_sync_pending" as const,
  runtime_active_base_url_revision: 1,
  runtime_pending_base_url_revision: 2,
  runtime_active_status_revision: 4,
  runtime_pending_status_revision: null,
  runtime_effective_status: "enabled" as const,
  archived_at: null,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

describe("ProviderOriginsSection", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.list.mockResolvedValue({ items: [endpoint], total: 1 });
  });

  it("does not render a stale breaker snapshot while runtime sync is pending", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProviderOriginsSection providerId={3} />
      </TestProviders>,
    );

    expect(
      await screen.findByText("https://api.example.test/v1"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "查看 primary 运行态" }),
    );

    expect(await screen.findAllByText("配置同步中")).toHaveLength(2);
    expect(screen.getByText(/旧快照不作为当前事实展示/)).toBeVisible();
    expect(mocks.getRuntime).not.toHaveBeenCalled();
  });

  it("shows objective endpoint breaker facts only for the active revision", async () => {
    mocks.list.mockResolvedValue({
      items: [
        {
          ...endpoint,
          runtime_sync_pending: false,
          runtime_sync_state: "active",
          runtime_active_base_url_revision: 2,
        },
      ],
      total: 1,
    });
    mocks.getRuntime.mockResolvedValue({
      scope: "origin",
      id: 7,
      exists: true,
      state: "open",
      open_remaining_ms: 12_000,
      open_level: 1,
      eligible_successes: 15,
      eligible_failures: 5,
      consecutive_failures: 3,
      error_rate: 0.25,
      sample_count: 20,
      ttft_ewma_ms: 0,
      ttft_samples: 0,
      ttft_sample_source: "stream_only",
      active_base_url_revision: 2,
      pending_base_url_revision: 0,
      active_status_revision: 4,
      pending_status_revision: 0,
      effective_status: "enabled",
    });

    render(
      <TestProviders>
        <ProviderOriginsSection providerId={3} />
      </TestProviders>,
    );

    expect(await screen.findByText("熔断中")).toBeVisible();
    expect(screen.getByText("错误率 25.0% · 20 个样本")).toBeVisible();
    expect(screen.getByText("已同步")).toBeVisible();
  });
});
