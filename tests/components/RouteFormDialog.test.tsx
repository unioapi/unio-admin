import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
  listChannels: vi.fn(),
}));

vi.mock("@/lib/api/routes", () => ({
  createRoute: mocks.createRoute,
  updateRoute: mocks.updateRoute,
}));
vi.mock("@/lib/api/channels", () => ({
  listChannels: mocks.listChannels,
}));
vi.mock("@/components/routes/RoutePriceCalculator", () => ({
  RoutePriceCalculator: ({ priceRatio }: { priceRatio: string }) => (
    <input aria-label="售价倍率" value={priceRatio} readOnly />
  ),
}));
vi.mock("@/components/routes/RouteChannelMarginTable", () => ({
  RouteChannelMarginTable: ({
    channels,
    onToggleChannel,
  }: {
    channels: Array<{ id: number; name: string; status?: string }>;
    onToggleChannel: (id: number) => void;
  }) => (
    <div>
      {channels.map((channel) => (
        <button key={channel.id} type="button" onClick={() => onToggleChannel(channel.id)}>
          选择 {channel.name}
          {channel.status === "disabled" ? "（停用）" : ""}
        </button>
      ))}
    </div>
  ),
}));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("RouteFormDialog", () => {
  beforeEach(() => {
    mocks.createRoute.mockResolvedValue({ id: 1 });
    mocks.listChannels.mockResolvedValue({
      total: 2,
      items: [
        { id: 10, name: "channel-a", status: "enabled" },
        { id: 11, name: "channel-b", status: "enabled" },
      ],
    });
  });

  it("requires an explicit channel pool and sends only the balanced contract", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <RouteFormDialog open onOpenChange={vi.fn()} route={null} onSaved={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getAllByPlaceholderText("继承线路默认限流")).toHaveLength(3);
    expect(screen.getByPlaceholderText("继承全局并发")).toBeVisible();
    expect(screen.queryByText("会话粘性")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /线路名/ }), "balanced-route");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("均衡线路至少选择一条渠道")).toBeVisible();
    expect(mocks.createRoute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "选择 channel-a" }));
    await user.type(screen.getByRole("spinbutton", { name: "并发" }), "4");
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(mocks.createRoute).toHaveBeenCalledTimes(1));
    const input = mocks.createRoute.mock.calls[0][0];
    expect(input).toMatchObject({
      name: "balanced-route",
      mode: "balanced",
      channel_ids: [10],
      concurrency_limit: 4,
    });
    expect(input).not.toHaveProperty("pool_kind");
    expect(input).not.toHaveProperty("sticky_enabled");
  });

  it("marks disabled channels, hides archived channels, and confirms before create", async () => {
    const user = userEvent.setup();
    mocks.listChannels.mockImplementation(({ status }: { status?: string }) =>
      Promise.resolve({
        total: 2,
        items: status === "disabled"
          ? [
              { id: 20, name: "channel-disabled", status: "disabled" },
              { id: 21, name: "channel-archived", status: "archived" },
            ]
          : [{ id: 10, name: "channel-enabled", status: "enabled" }],
      }),
    );

    render(
      <TestProviders>
        <RouteFormDialog open onOpenChange={vi.fn()} route={null} onSaved={vi.fn()} />
      </TestProviders>,
    );

    const disabledChannel = await screen.findByRole("button", {
      name: "选择 channel-disabled（停用）",
    });
    expect(disabledChannel).toBeVisible();
    expect(screen.queryByText(/channel-archived/)).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /线路名/ }), "disabled-route");
    await user.click(disabledChannel);
    await user.click(screen.getByRole("button", { name: "创建" }));

    expect(
      await screen.findByRole("heading", { name: "确认使用停用渠道" }),
    ).toBeVisible();
    expect(screen.getByText(/已选择停用渠道「channel-disabled」/)).toBeVisible();
    expect(mocks.createRoute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "仍然创建" }));
    await waitFor(() => expect(mocks.createRoute).toHaveBeenCalledTimes(1));
    expect(mocks.createRoute.mock.calls[0][0]).toMatchObject({ channel_ids: [20] });
  });

  it("confirms a disabled channel already selected while editing", async () => {
    const user = userEvent.setup();
    mocks.updateRoute.mockResolvedValue({ id: 7 });
    mocks.listChannels.mockImplementation(({ status }: { status?: string }) =>
      Promise.resolve({
        total: 1,
        items: status === "disabled"
          ? [{ id: 20, name: "channel-disabled", status: "disabled" }]
          : [],
      }),
    );

    render(
      <TestProviders>
        <RouteFormDialog
          open
          onOpenChange={vi.fn()}
          route={{
            id: 7,
            name: "existing-route",
            mode: "balanced",
            status: "enabled",
            price_ratio: "1",
            rpm_limit: null,
            tpm_limit: null,
            rpd_limit: null,
            concurrency_limit: null,
            description: null,
            channels: [{
              channel_id: 20,
              channel_name: "channel-disabled",
              provider_id: 1,
              provider_slug: "provider-a",
            }],
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
            archived_at: null,
          }}
          onSaved={vi.fn()}
        />
      </TestProviders>,
    );

    expect(
      await screen.findByRole("button", { name: "选择 channel-disabled（停用）" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByRole("heading", { name: "确认使用停用渠道" }),
    ).toBeVisible();
    expect(mocks.updateRoute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "仍然保存" }));
    await waitFor(() => expect(mocks.updateRoute).toHaveBeenCalledTimes(1));
  });
});
