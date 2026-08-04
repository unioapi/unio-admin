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
  name: "channel-a",
  protocol: "openai",
  adapter_key: "openai",
  origin: "https://api.example.test/v1",
  config_revision: 2,
  capacity_revision: 1,
  runtime_sync_pending: false,
  credential: "secret",
  status: "enabled",
  priority: 0,
  response_timeout_ms: null,
  first_token_timeout_ms: null,
  sticky_enabled: null,
  sticky_ttl_ms: null,
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

describe("ChannelFormDialog Provider binding", () => {
  beforeEach(() => {
    mocks.listAllProviders.mockResolvedValue([
      {
        id: 3,
        name: "Provider A",
        slug: "provider-a",
        origin: "https://api.example.test/v1",
        origin_revision: 2,
        status: "enabled",
        status_revision: 1,
      },
    ]);
    mocks.updateChannel.mockResolvedValue(channel);
  });

  it("shows Provider origin as read-only and submits capacity and timeout settings", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ChannelFormDialog open onOpenChange={vi.fn()} channel={channel} />
      </TestProviders>,
    );

    const apiRoot = await screen.findByRole("textbox", { name: "API Root" });
    expect(apiRoot).toBeDisabled();
    await waitFor(() => {
      expect(apiRoot).toHaveValue("https://api.example.test/v1");
    });
    expect(screen.queryByText("RPM")).not.toBeInTheDocument();
    expect(screen.queryByText("RPD")).not.toBeInTheDocument();
    expect(screen.queryByText("TPM")).not.toBeInTheDocument();

    const responseTimeout = screen.getByRole("spinbutton", { name: "响应超时（毫秒）" });
    const firstTokenTimeout = screen.getByRole("spinbutton", { name: "上游首字超时（毫秒）" });
    const concurrency = screen.getByRole("spinbutton", { name: "并发容量" });
    await user.type(responseTimeout, "200000");
    await user.type(firstTokenTimeout, "60000");
    await user.type(concurrency, "12");

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.updateChannel).toHaveBeenCalledTimes(1));

    const input = mocks.updateChannel.mock.calls[0][0];
    expect(input).toMatchObject({
      id: 9,
      provider_id: 3,
      response_timeout_ms: 200000,
      first_token_timeout_ms: 60000,
      concurrency_limit: 12,
    });
    expect(input).not.toHaveProperty("provider_origin_id");
    expect(input).not.toHaveProperty("rpm_limit");
    expect(input).not.toHaveProperty("rpd_limit");
    expect(input).not.toHaveProperty("tpm_limit");
  });

  it("uses fixed Priority options and submits an enabled Channel Sticky TTL", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ChannelFormDialog open onOpenChange={vi.fn()} channel={channel} />
      </TestProviders>,
    );

    const priority = await screen.findByRole("combobox", { name: "优先级" });
    await user.click(priority);
    expect(screen.getAllByRole("option")).toHaveLength(11);
    await user.click(screen.getByRole("option", { name: "20" }));

    const sticky = screen.getByRole("combobox", { name: "会话粘性" });
    await user.click(sticky);
    await user.click(screen.getByRole("option", { name: "开启" }));
    const ttl = screen.getByRole("spinbutton", { name: "渠道 Sticky TTL" });
    expect(ttl).toHaveValue(30);
    await user.clear(ttl);
    await user.type(ttl, "15");

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.updateChannel).toHaveBeenCalledTimes(1));
    expect(mocks.updateChannel.mock.calls[0][0]).toMatchObject({
      priority: 20,
      sticky_enabled: true,
      sticky_ttl_ms: 15 * 60 * 1_000,
    });
  });
});
