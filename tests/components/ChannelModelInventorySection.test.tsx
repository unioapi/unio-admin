import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelModelInventorySection } from "@/components/channels/ChannelModelInventorySection";

const mocks = vi.hoisted(() => ({
  getInventory: vi.fn(),
  updateBinding: vi.fn(),
  listDiscoveries: vi.fn(),
  getOpsModels: vi.fn(),
}));

vi.mock("@/lib/api/channelModelInventory", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/channelModelInventory")>();
  return {
    ...original,
    getChannelModelInventory: mocks.getInventory,
    listChannelModelDiscoveries: mocks.listDiscoveries,
  };
});
vi.mock("@/lib/api/channelModels", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/channelModels")>();
  return { ...original, updateChannelModel: mocks.updateBinding };
});
vi.mock("@/lib/api/channelsOps", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/channelsOps")>();
  return { ...original, getChannelOpsModels: mocks.getOpsModels };
});

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const failedInventory = {
  channel: {
    id: 7,
    name: "upstream-a",
    status: "disabled",
    protocol: "openai",
    adapter_key: "openai",
    provider_id: 3,
    provider_slug: "provider-a",
  },
  latest_discovery: {
    id: 12,
    channel_id: 7,
    source: "manual",
    status: "failed",
    channel_config_revision: 2,
    provider_origin_revision: 2,
    provider_status_revision: 1,
    attempt_count: 3,
    total_count: 0,
    succeeded_count: 0,
    failed_count: 0,
    warning_code: null,
    error_code: "upstream_timeout",
    message: "读取上游模型列表超时",
    created_at: "2026-08-07T00:00:00Z",
    started_at: "2026-08-07T00:00:00Z",
    completed_at: "2026-08-07T00:00:03Z",
  },
  snapshot: {
    id: 10,
    channel_id: 7,
    source: "manual",
    status: "succeeded",
    channel_config_revision: 2,
    provider_origin_revision: 2,
    provider_status_revision: 1,
    attempt_count: 1,
    total_count: 1,
    succeeded_count: 0,
    failed_count: 0,
    warning_code: null,
    error_code: null,
    message: null,
    created_at: "2026-08-06T00:00:00Z",
    started_at: "2026-08-06T00:00:00Z",
    completed_at: "2026-08-06T00:00:01Z",
  },
  snapshot_stale: false,
  stats: { discovered: 1, bindings: 1, new: 0, pending: 1 },
  items: [
    {
      upstream_model: "provider-model",
      owned_by: "provider-a",
      upstream_created_at: null,
      discovery_state: "discovered",
      bindings: [
        {
          id: 21,
          model_id: 9,
          model_external_id: "local-model",
          model_display_name: "Local Model",
          model_status: "enabled",
          upstream_model: "provider-model",
          status: "disabled",
          adopted_canonical_id: "provider-a/provider-model",
          verification: {
            item_id: 33,
            run_id: 31,
            status: "succeeded",
            current: true,
            http_status: 200,
            error_code: null,
            message: null,
            latency_ms: 42,
            completed_at: "2026-08-06T00:00:02Z",
          },
        },
      ],
      match: { kind: "bound", exact_model: null, catalog_candidates: [] },
    },
  ],
};

describe("ChannelModelInventorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInventory.mockResolvedValue(failedInventory);
    mocks.updateBinding.mockResolvedValue({});
    mocks.listDiscoveries.mockResolvedValue({ items: [], total: 0 });
    mocks.getOpsModels.mockResolvedValue([]);
  });

  it("keeps the last successful snapshot visible after discovery fails", async () => {
    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByText("最近一次发现失败")).toBeVisible();
    expect(screen.getByText(/当前仍展示上次成功快照/)).toBeVisible();
    expect(screen.getByText("provider-model")).toBeVisible();
    expect(screen.getByText("Local Model")).toBeVisible();
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "上游模型 ID",
      "绑定状态",
      "上游状态",
      "本地模型",
      "参考目录",
      "验证状态",
      "操作",
    ]);
    expect(screen.getByRole("tab", { name: "模型清单 1" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: /待处理/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /已绑定/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /全部发现/ })).not.toBeInTheDocument();
  });

  it("filters pending models inside the shared inventory table", async () => {
    const user = userEvent.setup();
    const inventory = structuredClone(failedInventory);
    const readyItem = structuredClone(inventory.items[0]);
    readyItem.upstream_model = "ready-provider-model";
    readyItem.bindings[0].id = 22;
    readyItem.bindings[0].model_external_id = "ready-local-model";
    readyItem.bindings[0].model_display_name = "Ready Model";
    readyItem.bindings[0].upstream_model = "ready-provider-model";
    readyItem.bindings[0].status = "enabled";
    inventory.items.push(readyItem);
    mocks.getInventory.mockResolvedValue(inventory);

    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("ready-provider-model")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "处理状态" }));
    await user.click(screen.getByText("待处理"));

    expect(table.getByText("provider-model")).toBeVisible();
    expect(table.queryByText("ready-provider-model")).not.toBeInTheDocument();
  });

  it("uses current successful verification evidence when enabling a binding", async () => {
    const user = userEvent.setup();
    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    await user.click(
      await screen.findByRole("button", { name: "模型操作：Local Model" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "启用" }));
    await waitFor(() => expect(mocks.updateBinding).toHaveBeenCalledTimes(1));
    expect(mocks.updateBinding).toHaveBeenCalledWith({
      channelId: 7,
      modelId: 9,
      upstream_model: "provider-model",
      status: "enabled",
      verification_item_id: 33,
    });
  });

  it("renders a current failed verification in destructive red", async () => {
    const user = userEvent.setup();
    const inventory = structuredClone(failedInventory);
    inventory.items[0].bindings[0].verification.status = "failed";
    inventory.items[0].bindings[0].verification.latency_ms = 1032;
    mocks.getInventory.mockResolvedValue(inventory);

    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByText("验证失败 · 1032ms")).toHaveClass(
      "text-destructive",
    );
    await user.click(
      screen.getByRole("button", { name: "模型操作：Local Model" }),
    );
    expect(screen.getByRole("menuitem", { name: "启用" })).toHaveAttribute(
      "data-disabled",
    );
  });

  it("sorts inventory rows by the selected order", async () => {
    const user = userEvent.setup();
    const inventory = structuredClone(failedInventory);
    inventory.items.push({
      ...inventory.items[0],
      upstream_model: "z-provider-model",
    });
    mocks.getInventory.mockResolvedValue(inventory);

    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    const table = within(await screen.findByRole("table"));
    let rows = table.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("provider-model");

    await user.click(screen.getByRole("button", { name: "上游模型 ID" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Desc" }));

    rows = table.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("z-provider-model");
  });

  it("defaults to binding status first and upstream status second", async () => {
    const inventory = structuredClone(failedInventory);
    const enabledNotSeen = structuredClone(inventory.items[0]);
    enabledNotSeen.upstream_model = "enabled-not-seen";
    enabledNotSeen.discovery_state = "not_seen";
    enabledNotSeen.bindings[0].upstream_model = "enabled-not-seen";
    enabledNotSeen.bindings[0].status = "enabled";

    const unboundDiscovered = structuredClone(inventory.items[0]);
    unboundDiscovered.upstream_model = "unbound-discovered";
    unboundDiscovered.bindings = [];
    unboundDiscovered.match = {
      kind: "none",
      exact_model: null,
      catalog_candidates: [],
    };

    const unboundNotSeen = structuredClone(unboundDiscovered);
    unboundNotSeen.upstream_model = "unbound-not-seen";
    unboundNotSeen.discovery_state = "not_seen";

    inventory.items = [
      enabledNotSeen,
      inventory.items[0],
      unboundDiscovered,
      unboundNotSeen,
    ];
    mocks.getInventory.mockResolvedValue(inventory);

    render(
      <ChannelModelInventorySection
        channelId={7}
        range={{ range: "24h" }}
        setup={false}
      />,
      { wrapper: Wrapper },
    );

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      expect.stringContaining("unbound-not-seen"),
      expect.stringContaining("unbound-discovered"),
      expect.stringContaining("provider-model"),
      expect.stringContaining("enabled-not-seen"),
    ]);
  });
});
