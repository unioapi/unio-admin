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
      rateLimitSetting(
        "gateway.channel_rate_limit_defaults",
        "渠道默认限流(RPM/TPM/RPD)",
        7,
      ),
      {
        key: "gateway.routing_balance",
        category: "gateway",
        label: "均衡路由",
        description: "均衡路由参数",
        hot_reload: true,
        default: {
          ttft_target_ms: 800,
          ttft_weight: 0.25,
          cost_weight: 0.5,
          minimum_routing_factor: 0.05,
          ttft_ewma_alpha: 0.2,
        },
        value: {
          ttft_target_ms: 800,
          ttft_weight: 0.25,
          minimum_routing_factor: 0.05,
          ttft_ewma_alpha: 0.2,
        },
        source: "redis" as const,
        revision: 8,
        runtime_active_revision: 8,
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

  it("renders and saves route and channel defaults as independent controls", async () => {
    const user = userEvent.setup();
    render(<RuntimeSettingsPanel />, { wrapper });

    expect(
      await screen.findByText("五个关键运行态控制以 Redis 激活版本为执行依据；其他网关设置由 applier 在约 5 秒内热更新"),
    ).toBeVisible();

    const routeTitle = screen.getByText("线路默认限流(RPM/TPM/RPD)");
    const channelTitle = screen.getByText("渠道默认限流(RPM/TPM/RPD)");
    const routeCard = routeTitle.closest('[data-slot="card"]');
    const channelCard = channelTitle.closest('[data-slot="card"]');
    expect(routeCard).not.toBeNull();
    expect(channelCard).not.toBeNull();
    if (!routeCard || !channelCard) return;

    expect(within(routeCard).getByText("线路限流命中后直接返回 429")).toBeVisible();
    expect(
      within(routeCard).getByText(
        "在线路未单独设置限额时使用；RPM/RPD 在请求入口执行，TPM 在候选估算后、上游调用前执行。命中均直接返回 429；Redis 或运行态存储不可用时固定拒绝准入。",
      ),
    ).toBeVisible();
    expect(
      within(channelCard).getByText("渠道限流命中后自动尝试后备渠道"),
    ).toBeVisible();
    expect(within(routeCard).getByRole("textbox")).toHaveValue("0");
    expect(within(channelCard).getByRole("textbox")).toHaveValue("0");
    expect(within(routeCard).getAllByRole("spinbutton")).toHaveLength(2);
    expect(within(channelCard).getAllByRole("spinbutton")).toHaveLength(2);
    for (const input of [
      ...within(routeCard).getAllByRole("spinbutton"),
      ...within(channelCard).getAllByRole("spinbutton"),
    ]) {
      expect(input).toHaveValue(0);
    }

    await user.click(within(routeCard).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.route_rate_limit_defaults",
        { rpm: 0, tpm: 0, rpd: 0 },
      ),
    );

    await user.click(within(channelCard).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.channel_rate_limit_defaults",
        { rpm: 0, tpm: 0, rpd: 0 },
      ),
    );
  });

  it("treats a legacy routing balance payload as zero cost weight and saves it explicitly", async () => {
    const user = userEvent.setup();
    render(<RuntimeSettingsPanel />, { wrapper });

    const balanceTitle = await screen.findByText("均衡路由");
    const balanceCard = balanceTitle.closest('[data-slot="card"]');
    expect(balanceCard).not.toBeNull();
    if (!balanceCard) return;

    const costWeight = within(balanceCard).getByDisplayValue("0");
    expect(costWeight).toBeVisible();
    await user.clear(costWeight);
    await user.type(costWeight, "0.4");
    await user.click(
      within(balanceCard).getByRole("button", { name: "保存" }),
    );

    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.routing_balance",
        {
          ttft_target_ms: 800,
          ttft_weight: 0.25,
          cost_weight: 0.4,
          minimum_routing_factor: 0.05,
          ttft_ewma_alpha: 0.2,
        },
      ),
    );
  });
});
