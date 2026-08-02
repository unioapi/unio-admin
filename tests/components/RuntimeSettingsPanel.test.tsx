import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSettings: vi.fn(),
  updateSetting: vi.fn(),
}));

vi.mock("@/lib/api/system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/system")>();
  return {
    ...actual,
    listSettings: mocks.listSettings,
    updateSetting: mocks.updateSetting,
  };
});

vi.mock("@/components/system/AnthropicBetaPolicyCard", () => ({
  AnthropicBetaPolicyCard: () => null,
}));

import { RuntimeSettingsPanel } from "@/components/system/RuntimeSettingsPanel";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function rateLimitSetting(key: string, label: string, revision: number) {
  return {
    key,
    category: "gateway",
    label,
    description: `${label}说明`,
    hot_reload: true,
    default: { rpm: 0, tpm: 0, rpd: 0 },
    value: { rpm: 0, tpm: 0, rpd: 0 },
    source: "redis" as const,
    revision,
    runtime_active_revision: revision,
    runtime_pending_revision: 0,
    runtime_sync_state: "active" as const,
  };
}

describe("RuntimeSettingsPanel", () => {
  beforeEach(() => {
    mocks.listSettings.mockReset();
    mocks.updateSetting.mockReset();
    mocks.listSettings.mockResolvedValue([
      rateLimitSetting(
        "gateway.route_rate_limit_defaults",
        "线路默认限流(RPM/TPM/RPD)",
        5,
      ),
      {
        key: "gateway.routing_balance",
        category: "gateway",
        label: "均衡路由",
        description: "均衡路由参数",
        hot_reload: true,
        default: {
          cost_weight_pct: 25,
          concurrency_weight_pct: 20,
          ttft_weight_pct: 25,
          error_rate_weight_pct: 20,
          priority_weight_pct: 10,
          ttft_window_ms: 1_800_000,
          ttft_penalty_unit_ms: 1_000,
          ttft_penalty_points_per_unit: 2.5,
          error_window_ms: 1_800_000,
          error_penalty_points_per_percent: 2.5,
        },
        value: {
          cost_weight_pct: 25,
          concurrency_weight_pct: 20,
          ttft_weight_pct: 25,
          error_rate_weight_pct: 20,
          priority_weight_pct: 10,
          ttft_window_ms: 1_800_000,
          ttft_penalty_unit_ms: 1_000,
          ttft_penalty_points_per_unit: 2.5,
          error_window_ms: 1_800_000,
          error_penalty_points_per_percent: 2.5,
        },
        source: "redis" as const,
        revision: 8,
        runtime_active_revision: 8,
        runtime_pending_revision: 0,
        runtime_sync_state: "active" as const,
      },
      {
        key: "gateway.routing_sticky",
        category: "gateway",
        label: "会话粘性",
        description: "渠道会话粘性默认",
        hot_reload: true,
        default: {
          enabled_default: true,
          ttl_ms: 1_800_000,
        },
        value: {
          enabled_default: true,
          ttl_ms: 1_800_000,
        },
        source: "db" as const,
        revision: 1,
        runtime_active_revision: 0,
        runtime_pending_revision: 0,
        runtime_sync_state: "active" as const,
      },
    ]);
    mocks.updateSetting.mockResolvedValue({
      key: "gateway.route_rate_limit_defaults",
      revision: 6,
      state: "active",
      active_revision: 6,
      pending_revision: 0,
    });
  });

  it("renders and saves the route rate-limit defaults", async () => {
    const user = userEvent.setup();
    render(<RuntimeSettingsPanel />, { wrapper });

    expect(
      await screen.findByText("四个关键运行态控制以 Redis 激活版本为执行依据；其他网关设置由 applier 在约 5 秒内热更新"),
    ).toBeVisible();

    const routeTitle = screen.getByText("线路默认限流(RPM/TPM/RPD)");
    const routeCard = routeTitle.closest('[data-slot="card"]');
    expect(routeCard).not.toBeNull();
    if (!routeCard) return;

    expect(
      within(routeCard).getByRole("button", {
        name: "线路默认限流(RPM/TPM/RPD)说明",
      }),
    ).toBeVisible();
    expect(
      within(routeCard).queryByText('{"rpm":0,"tpm":0,"rpd":0}'),
    ).not.toBeInTheDocument();
    await user.click(
      within(routeCard).getByRole("button", { name: "配置详情" }),
    );
    expect(
      within(routeCard).getAllByText('{"rpm":0,"tpm":0,"rpd":0}'),
    ).toHaveLength(2);
    expect(within(routeCard).getByText("线路限流命中后直接返回 429")).toBeVisible();
    expect(
      within(routeCard).getByText(
        /渠道级 RPM、RPD、TPM\s*只作观测，不参与拦截和评分。/,
      ),
    ).toBeVisible();
    expect(within(routeCard).getByRole("textbox")).toHaveValue("0");
    expect(within(routeCard).getAllByRole("spinbutton")).toHaveLength(2);
    for (const input of within(routeCard).getAllByRole("spinbutton")) {
      expect(input).toHaveValue(0);
    }

    await user.click(within(routeCard).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.route_rate_limit_defaults",
        { rpm: 0, tpm: 0, rpd: 0 },
      ),
    );
  });

  it("edits the canonical five-part balance payload and requires weights totaling 100%", async () => {
    const user = userEvent.setup();
    render(<RuntimeSettingsPanel />, { wrapper });

    const balanceTitle = await screen.findByText("均衡路由");
    const balanceCard = balanceTitle.closest('[data-slot="card"]');
    expect(balanceCard).not.toBeNull();
    if (!balanceCard) return;

    const cost = within(balanceCard).getByRole("textbox", { name: "成本权重（%）" });
    const concurrency = within(balanceCard).getByRole("textbox", { name: "并发容量权重（%）" });
    expect(cost).toHaveValue("25");
    expect(concurrency).toHaveValue("20");
    expect(within(balanceCard).getByText("评分权重合计：100%")) .toBeVisible();

    await user.clear(cost);
    await user.type(cost, "40");
    expect(within(balanceCard).getByText("评分权重合计：115%")) .toBeVisible();
    expect(within(balanceCard).getByRole("button", { name: "保存" })).toBeDisabled();

    await user.clear(concurrency);
    await user.type(concurrency, "5");
    expect(within(balanceCard).getByText("评分权重合计：100%")) .toBeVisible();
    await user.click(within(balanceCard).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.routing_balance",
        {
          cost_weight_pct: 40,
          concurrency_weight_pct: 5,
          ttft_weight_pct: 25,
          error_rate_weight_pct: 20,
          priority_weight_pct: 10,
          ttft_window_ms: 1_800_000,
          ttft_penalty_unit_ms: 1_000,
          ttft_penalty_points_per_unit: 2.5,
          error_window_ms: 1_800_000,
          error_penalty_points_per_percent: 2.5,
        },
      ),
    );
  });

  it("shows the global sticky default as enabled with a 30 minute TTL", async () => {
    render(<RuntimeSettingsPanel />, { wrapper });
    const title = await screen.findByText("会话粘性");
    const card = title.closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    if (!card) return;

    expect(within(card).getByRole("switch", { name: "渠道默认开启会话粘性" })).toBeChecked();
    expect(within(card).getByDisplayValue("30")).toBeVisible();
    expect(within(card).getByText("分钟")).toBeVisible();
  });
});
