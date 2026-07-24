import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";
import type { Channel } from "@/lib/api/channels";

const mocks = vi.hoisted(() => ({
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  listAdapterKeys: vi.fn(),
  listAllProviders: vi.fn(),
  listProviderOrigins: vi.fn(),
}));

vi.mock("@/lib/api/channels", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/channels")>();
  return {
    ...original,
    createChannel: mocks.createChannel,
    updateChannel: mocks.updateChannel,
    listAdapterKeys: mocks.listAdapterKeys,
  };
});
vi.mock("@/lib/api/providers", () => ({
  listAllProviders: mocks.listAllProviders,
}));
vi.mock("@/lib/api/providerOrigins", () => ({
  listProviderOrigins: mocks.listProviderOrigins,
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const channel = {
  id: 9,
  provider_id: 3,
  provider_name: "Provider A",
  provider_origin_id: 7,
  provider_origin_name: "primary",
  provider_origin_status: "enabled",
  name: "channel-a",
  protocol: "openai",
  adapter_key: "openai",
  base_url: "https://api.example.test/v1",
  config_revision: 2,
  admission_limits_revision: 1,
  credential: "secret",
  status: "enabled",
  priority: 0,
  timeout_ms: null,
  rpm_limit: null,
  tpm_limit: null,
  rpd_limit: null,
  concurrency_limit: null,
  upstream_bills_on_disconnect: false,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
  archived_at: null,
  last_tested_at: null,
  last_test_ok: null,
  last_test_latency_ms: null,
  last_test_error: null,
} satisfies Channel;

describe("ChannelFormDialog P4 binding", () => {
  beforeEach(() => {
    mocks.listAllProviders.mockResolvedValue([
      { id: 3, name: "Provider A", slug: "provider-a", status: "enabled" },
    ]);
    mocks.listProviderOrigins.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 7,
          provider_id: 3,
          provider_name: "Provider A",
          name: "primary",
          base_url: "https://api.example.test/v1",
          base_url_revision: 2,
          status: "enabled",
          status_revision: 1,
          channel_count: 1,
          runtime_sync_pending: false,
          archived_at: null,
          created_at: "2026-07-22T00:00:00Z",
          updated_at: "2026-07-22T00:00:00Z",
        },
      ],
    });
    mocks.updateChannel.mockResolvedValue(channel);
  });

  it("shows 源站 ownership as read-only and submits only provider_origin_id", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ChannelFormDialog open onOpenChange={vi.fn()} channel={channel} />
      </TestProviders>,
    );

    const endpointProvider = await screen.findByRole("textbox", {
      name: "源站 服务商",
    });
    const apiRoot = screen.getByRole("textbox", { name: "API Root" });
    expect(endpointProvider).toBeDisabled();
    expect(apiRoot).toBeDisabled();
    await waitFor(() => {
      expect(endpointProvider).toHaveValue("Provider A（#3）");
      expect(apiRoot).toHaveValue("https://api.example.test/v1");
    });
    expect(screen.getAllByPlaceholderText("继承渠道默认限流")).toHaveLength(3);
    expect(screen.getByPlaceholderText("继承默认")).toHaveAttribute(
      "id",
      "concurrency_limit",
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.updateChannel).toHaveBeenCalledTimes(1));

    const input = mocks.updateChannel.mock.calls[0][0];
    expect(input).toMatchObject({ id: 9, provider_origin_id: 7 });
    expect(input).not.toHaveProperty("base_url");
  });
});
