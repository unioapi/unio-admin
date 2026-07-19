import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveWithReplacementDialog } from "@/components/common/ArchiveWithReplacementDialog";

const mocks = vi.hoisted(() => ({
  archiveChannel: vi.fn(),
  listChannels: vi.fn(),
  getChannelRoutes: vi.fn(),
  getProviderRoutes: vi.fn(),
  getRoute: vi.fn(),
}));

vi.mock("@/lib/api/channels", () => ({
  archiveChannel: mocks.archiveChannel,
  listChannels: mocks.listChannels,
}));
vi.mock("@/lib/api/providers", () => ({ archiveProvider: vi.fn() }));
vi.mock("@/lib/api/channelsOps", () => ({ getChannelOpsRoutes: mocks.getChannelRoutes }));
vi.mock("@/lib/api/providersOps", () => ({
  getProviderOpsRouteCatalog: mocks.getProviderRoutes,
}));
vi.mock("@/lib/api/routes", () => ({ getRoute: mocks.getRoute }));

function TestProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("ArchiveWithReplacementDialog", () => {
  beforeEach(() => {
    mocks.getChannelRoutes.mockResolvedValue([
      { id: 3, name: "critical-route", mode: "fixed", status: "enabled", price_ratio: "2" },
    ]);
    mocks.getRoute.mockResolvedValue({
      id: 3,
      name: "critical-route",
      mode: "fixed",
      status: "enabled",
      channels: [{ channel_id: 5, channel_name: "old", provider_id: 1, provider_slug: "p1" }],
    });
    mocks.listChannels.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 9,
          provider_id: 2,
          provider_name: "provider-b",
          name: "replacement",
          protocol: "openai",
          credential: "secret",
          base_url: "https://example.test",
          status: "enabled",
        },
      ],
    });
    mocks.archiveChannel.mockResolvedValue(undefined);
  });

  it("requires and submits a replacement when an enabled route would be emptied", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ArchiveWithReplacementDialog
          open
          onOpenChange={vi.fn()}
          target={{ kind: "channel", id: 5, name: "old" }}
          onArchived={vi.fn()}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("必须指定替代渠道")).toBeVisible();
    expect(screen.getByRole("link", { name: "critical-route" })).toBeVisible();
    expect(screen.getByRole("button", { name: "替换并归档" })).toBeDisabled();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /provider-b \/ replacement/ }));
    await user.click(screen.getByRole("button", { name: "替换并归档" }));

    await waitFor(() => expect(mocks.archiveChannel).toHaveBeenCalledWith(5, 9));
  });
});
