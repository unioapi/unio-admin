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
          economic_weight_pct: 45,
          health_weight_pct: 25,
          capacity_weight_pct: 20,
          priority_weight_pct: 10,
          ttft_target_ms: 800,
          ttft_weight: 0.25,
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
      {
        key: "gateway.routing_sticky",
        category: "gateway",
        label: "会话粘性",
        description: "渠道会话粘性默认",
        hot_reload: true,
        default: {
          enabled_default: true,
          ttl_ms: 1_800_000,
          tpm_wait_ms: 500,
          tpm_wait_jitter_ms: 100,
        },
        value: {
          enabled_default: true,
          ttl_ms: 1_800_000,
          tpm_wait_ms: 500,
          tpm_wait_jitter_ms: 100,
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

  it("normalizes a legacy balance payload and only saves four weights totaling 100%", async () => {
    const user = userEvent.setup();
    render(<RuntimeSettingsPanel />, { wrapper });

    const balanceTitle = await screen.findByText("均衡路由");
    const balanceCard = balanceTitle.closest('[data-slot="card"]');
    expect(balanceCard).not.toBeNull();
    if (!balanceCard) return;

    const economic = within(balanceCard).getByRole("textbox", { name: "经济权重（%）" });
    const health = within(balanceCard).getByRole("textbox", { name: "健康权重（%）" });
    expect(economic).toHaveValue("45");
    expect(health).toHaveValue("25");
    expect(within(balanceCard).getByText("评分权重合计：100%")) .toBeVisible();

    await user.clear(economic);
    await user.type(economic, "40");
    expect(within(balanceCard).getByText("评分权重合计：95%")) .toBeVisible();
    expect(within(balanceCard).getByRole("button", { name: "保存" })).toBeDisabled();

    await user.clear(health);
    await user.type(health, "30");
    expect(within(balanceCard).getByText("评分权重合计：100%")) .toBeVisible();
    await user.click(within(balanceCard).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        "gateway.routing_balance",
        {
          economic_weight_pct: 40,
          health_weight_pct: 30,
          capacity_weight_pct: 20,
          priority_weight_pct: 10,
          ttft_target_ms: 800,
          ttft_weight: 0.25,
          ttft_ewma_alpha: 0.2,
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
