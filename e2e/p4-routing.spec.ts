import { expect, test, type Page, type Route } from "@playwright/test";

const routeID = 42;
const apiPattern = "**/admin/v1/**";

type RuntimeState = "active" | "store_unavailable";

async function fulfillJSON(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  });
}

async function mockRouteOperations(page: Page, state: RuntimeState) {
  const observedAt = new Date().toISOString();
  await page.route(apiPattern, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await fulfillJSON(route, null, 204);
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname;
    if (path === `/admin/v1/routes/${routeID}`) {
      await fulfillJSON(route, {
        data: {
          id: routeID,
          name: "P4 全局路由",
          mode: "balanced",
          status: "enabled",
          price_ratio: "1.0",
          rpm_limit: null,
          tpm_limit: null,
          rpd_limit: null,
          sticky_enabled: null,
          description: "ProviderOrigin 全局运行态",
          channels: [
            {
              channel_id: 7,
              channel_name: "主渠道",
              provider_id: 3,
              provider_slug: "starapi",
            },
            {
              channel_id: 8,
              channel_name: "备用渠道",
              provider_id: 3,
              provider_slug: "starapi",
            },
            {
              channel_id: 9,
              channel_name: "版本落后渠道",
              provider_id: 3,
              provider_slug: "starapi",
            },
          ],
          created_at: observedAt,
          updated_at: observedAt,
          archived_at: null,
        },
      });
      return;
    }
    if (path === `/admin/v1/routes/${routeID}/ops/detail`) {
      await fulfillJSON(route, {
        data: {
          request_total: 20,
          request_succeeded: 19,
          success_rate: 0.95,
          fallback_total: 1,
          fallback_rate: 0.05,
          no_channel_total: 0,
          latency_p50: 800,
          latency_p95: 1200,
          serviceable: state === "active",
          abnormal: state !== "active",
          route_status: "enabled",
        },
      });
      return;
    }
    if (path === `/admin/v1/routes/${routeID}/ops/reachable-models`) {
      await fulfillJSON(route, {
        data: [{ model_id: "gpt-p4", display_name: "GPT P4" }],
      });
      return;
    }
    if (path === `/admin/v1/routes/${routeID}/ops/runtime`) {
      const denied = state !== "active";
      await fulfillJSON(route, {
        data: {
          route_id: routeID,
          mode: "balanced",
          route_status: "enabled",
          model_id: "gpt-p4",
          protocol: "openai",
          observed_at: observedAt,
          stale: denied,
          pool_size: 3,
          candidate_count: denied ? 0 : 1,
          no_redundancy: true,
          all_capacity_zero: false,
          runtime_sync_state: denied ? "store_unavailable" : "active",
          breaker_store_admission: denied ? "denied" : "normal",
          sources: [
            {
              name: "postgres",
              available: true,
              observed_at: observedAt,
              stale: false,
            },
            {
              name: "breaker_store",
              available: !denied,
              observed_at: denied ? null : observedAt,
              stale: denied,
            },
            {
              name: "attempts",
              available: true,
              observed_at: observedAt,
              stale: false,
            },
          ],
          channels: [
            runtimeChannel({
              channel_id: 7,
              channel_name: "主渠道",
              provider_origin_id: 11,
              provider_origin_name: "Primary Endpoint",
              eligible: false,
              excluded_reason: denied ? "store_unavailable" : "breaker_open",
              origin_breaker_state: denied ? null : "open",
              origin_open_remaining_ms: denied ? null : 12_400,
              channel_breaker_state: denied ? null : "closed",
              cooldown_remaining_ms: denied ? 0 : 12_400,
              model_permission_paused: !denied,
              model_permission_recheck_state: denied ? "unavailable" : "queued",
              current_order: 0,
              final_weight: 0,
              runtime_sync_state: denied ? "store_unavailable" : "active",
              breaker_store_admission: denied ? "denied" : "normal",
            }),
            runtimeChannel({
              channel_id: 9,
              channel_name: "版本落后渠道",
              provider_origin_id: 13,
              provider_origin_name: "Stale Endpoint",
              eligible: !denied,
              excluded_reason: denied ? "store_unavailable" : undefined,
              channel_config_revision: 6,
              runtime_channel_config_revision: 5,
              channel_config_revision_current: false,
              runtime_revision_current: false,
              current_order: denied ? 0 : 2,
              runtime_sync_state: denied ? "store_unavailable" : "active",
              breaker_store_admission: denied ? "denied" : "normal",
            }),
            runtimeChannel({
              channel_id: 8,
              channel_name: "备用渠道",
              provider_origin_id: 12,
              provider_origin_name: "Backup Endpoint",
              eligible: !denied,
              excluded_reason: denied ? "store_unavailable" : undefined,
              origin_breaker_state: denied ? null : "closed",
              channel_breaker_state: denied ? null : "closed",
              current_order: denied ? 0 : 1,
              runtime_sync_state: denied ? "store_unavailable" : "active",
              breaker_store_admission: denied ? "denied" : "normal",
            }),
          ],
        },
      });
      return;
    }
    if (path === `/admin/v1/routes/${routeID}/ops/decisions`) {
      await fulfillJSON(route, {
        data: [],
        meta: { total: 0 },
      });
      return;
    }

    await fulfillJSON(route, { error: { message: `unmocked ${path}` } }, 404);
  });
}

async function mockRuntimeSettings(page: Page) {
  await page.route(apiPattern, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await fulfillJSON(route, null, 204);
      return;
    }

    const path = new URL(request.url()).pathname;
    if (path === "/admin/v1/system/runtime-diagnostics") {
      await fulfillJSON(route, {
        data: {
          readiness: { ready: true, reason: "ready" },
          runtime_state_epoch: { state: "ready", revision: 4, match: true },
          operations: {
            origin_routing: { nonterminal_count: 0, oldest_age_seconds: null },
            runtime_control: { nonterminal_count: 0, oldest_age_seconds: null },
          },
        },
      });
      return;
    }
    if (path === "/admin/v1/settings") {
      await fulfillJSON(route, {
        data: [
          {
            key: "gateway.route_rate_limit_defaults",
            category: "gateway",
            label: "线路默认限流(RPM/TPM/RPD)",
            description: "线路未单独配置时使用。",
            hot_reload: true,
            default: { rpm: 0, tpm: 0, rpd: 0 },
            value: { rpm: 0, tpm: 0, rpd: 0 },
            source: "redis",
            revision: 5,
            runtime_active_revision: 5,
            runtime_pending_revision: 0,
            runtime_sync_state: "active",
          },
          {
            key: "gateway.channel_rate_limit_defaults",
            category: "gateway",
            label: "渠道默认限流(RPM/TPM/RPD)",
            description: "渠道未单独配置时使用。",
            hot_reload: true,
            default: { rpm: 0, tpm: 0, rpd: 0 },
            value: { rpm: 0, tpm: 0, rpd: 0 },
            source: "redis",
            revision: 7,
            runtime_active_revision: 7,
            runtime_pending_revision: 0,
            runtime_sync_state: "active",
          },
        ],
      });
      return;
    }
    if (path === "/admin/v1/provider-settings/anthropic/beta-policy") {
      await fulfillJSON(route, { data: { mode: "passthrough", list: [] } });
      return;
    }

    await fulfillJSON(route, { error: { message: `unmocked ${path}` } }, 404);
  });
}

function runtimeChannel(overrides: Record<string, unknown>) {
  return {
    channel_id: 7,
    channel_name: "主渠道",
    channel_status: "enabled",
    provider_id: 3,
    provider_name: "StarAPI",
    provider_status: "enabled",
    provider_origin_id: 11,
    provider_origin_name: "Primary Endpoint",
    provider_origin_status: "enabled",
    origin_base_url_revision: 3,
    origin_status_revision: 4,
    runtime_origin_base_url_revision: 3,
    runtime_origin_status_revision: 4,
    pending_origin_base_url_revision: null,
    pending_origin_status_revision: null,
    origin_base_url_revision_current: true,
    origin_status_revision_current: true,
    origin_state_generation: 2,
    origin_base_url_fence_generation: 2,
    origin_status_fence_generation: 2,
    channel_config_revision: 5,
    runtime_channel_config_revision: 5,
    channel_config_revision_current: true,
    channel_admission_limits_revision: 6,
    runtime_channel_admission_limits_revision: 6,
    channel_admission_limits_revision_current: true,
    route_rate_limits_revision: 7,
    channel_rate_limits_revision: 11,
    global_concurrency_revision: 8,
    circuit_breaker_revision: 9,
    routing_balance_revision: 10,
    runtime_control_state: "active",
    runtime_revision_current: true,
    protocol: "openai",
    adapter_key: "openai",
    priority: 10,
    eligible: true,
    concurrency_used: 1,
    concurrency_limit: 10,
    concurrency_remaining: 0.9,
    rpm_used: 120,
    rpm_limit: 600,
    rpm_remaining: 0.8,
    rpd_used: 30,
    rpd_limit: 300,
    rpd_remaining: 0.9,
    tpm_used: 25_000,
    tpm_limit: 100_000,
    tpm_remaining: 0.75,
    capacity_score: 0.75,
    final_weight: 0.606,
    pressure: 0.175,
    capacity_unknown: false,
    capacity_read_failed: false,
    origin_breaker_state: "closed",
    origin_open_remaining_ms: null,
    channel_breaker_state: "closed",
    channel_open_remaining_ms: null,
    error_rate: 0.1,
    error_samples: 20,
    ttft_ewma_ms: 820,
    ttft_samples: 18,
    ttft_sample_source: "stream_only",
    cooldown_remaining_ms: 0,
    model_permission_paused: false,
    model_permission_recheck_state: "cleared",
    runtime_sync_state: "active",
    breaker_store_admission: "normal",
    current_order: 1,
    selected_1m: 8,
    selected_5m: 31,
    selected_share_1m: 0.8,
    selected_share_5m: 0.7,
    fallback_1m: 0,
    margin_status: "safe",
    ...overrides,
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("unio_admin_token", "p4-e2e-token");
  });
});

test("shows ProviderOrigin breaker facts and stream-only TTFT", async ({
  page,
}) => {
  await mockRouteOperations(page, "active");
  await page.goto(`/routes/${routeID}`);

  await expect(page.getByRole("heading", { name: "实时路由" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Endpoint 熔断" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "渠道熔断" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "流式 TTFT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "RPM / RPD" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "429 / 权限" })).toBeVisible();
  await expect(page.getByText("Primary Endpoint", { exact: true })).toBeVisible();
  await expect(page.getByText("Backup Endpoint", { exact: true })).toBeVisible();
  const backup = page.getByRole("row", { name: /备用渠道/ });
  await expect(
    backup.getByText("18 个流式样本", { exact: true }),
  ).toBeVisible();
  await expect(backup.getByText("820ms", { exact: true })).toBeVisible();
  await expect(backup.getByText(/RPM 120 \/ 600 · 剩余 80\.0%/)).toBeVisible();
  await expect(backup.getByText(/RPD 30 \/ 300 · 剩余 90\.0%/)).toBeVisible();
  await expect(
    backup.getByText("运行态已同步", { exact: true }),
  ).toBeVisible();
  await expect(
    backup.getByText("默认限流 线路 r7 · 渠道 r11", { exact: true }),
  ).toBeVisible();
  await expect(
    backup.getByText("控制 并发 r8 · 熔断 r9 · 均衡 r10", { exact: true }),
  ).toBeVisible();

  const primary = page.getByRole("row", { name: /主渠道/ });
  await expect(
    primary.getByText("429 冷却 13 秒", { exact: true }),
  ).toBeVisible();
  await expect(
    primary.getByText("权限暂停 · 待复检", { exact: true }),
  ).toBeVisible();

  const stale = page.getByRole("row", { name: /版本落后渠道/ });
  await expect(stale.getByText("版本不一致", { exact: true })).toBeVisible();
  await expect(stale.getByText(/渠道 r6\/r5/)).toBeVisible();
  await expect(stale.getByText("820ms", { exact: true })).toHaveCount(0);
  await expect(stale.getByText("最终权重 0.6060", { exact: true })).toHaveCount(0);
  await expect(page.getByText("容量读取降级", { exact: true })).toHaveCount(0);

  await backup.getByText("最终权重 0.6060", { exact: true }).hover();
  await expect(
    page.getByText(/流式和非流式调度共用/),
  ).toBeVisible();
});

test("renders infrastructure failure as denied admission", async ({ page }) => {
  await mockRouteOperations(page, "store_unavailable");
  await page.goto(`/routes/${routeID}`);

  await expect(
    page.getByText("基础设施故障，准入已拒绝", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("已拒绝", { exact: true })).toBeVisible();
  await expect(page.getByText("事实不可用", { exact: true })).toBeVisible();
  await expect(page.getByText("820ms", { exact: true })).toHaveCount(0);
  await expect(page.getByText("读取降级", { exact: true })).toHaveCount(0);
});

test("shows independent route and channel rate-limit defaults", async ({ page }) => {
  await mockRuntimeSettings(page);
  await page.goto("/system");

  await expect(
    page.getByText(
      "五个关键运行态控制以 Redis 激活版本为执行依据；其他网关设置由 applier 在约 5 秒内热更新",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/^线路默认限流\(RPM\/TPM\/RPD\)/),
  ).toBeVisible();
  await expect(
    page.getByText(/^渠道默认限流\(RPM\/TPM\/RPD\)/),
  ).toBeVisible();
  await expect(
    page.getByText("线路限流命中后直接返回 429", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("渠道限流命中后自动尝试后备渠道", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('{"rpm":0,"tpm":0,"rpd":0}', { exact: false }),
  ).toHaveCount(4);
});
