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
    channels: Array<{ id: number; name: string }>;
    onToggleChannel: (id: number) => void;
  }) => (
    <div>
      {channels.map((channel) => (
        <button key={channel.id} type="button" onClick={() => onToggleChannel(channel.id)}>
          选择 {channel.name}
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
        { id: 10, name: "channel-a" },
        { id: 11, name: "channel-b" },
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

    await user.type(screen.getByRole("textbox", { name: /线路名/ }), "balanced-route");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("均衡线路至少选择一条渠道")).toBeVisible();
    expect(mocks.createRoute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "选择 channel-a" }));
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(mocks.createRoute).toHaveBeenCalledTimes(1));
    const input = mocks.createRoute.mock.calls[0][0];
    expect(input).toMatchObject({
      name: "balanced-route",
      mode: "balanced",
      channel_ids: [10],
    });
    expect(input).not.toHaveProperty("pool_kind");
  });
});
