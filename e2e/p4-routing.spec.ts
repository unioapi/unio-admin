import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  RouteRuntime,
  RouteRuntimeChannel,
} from "../src/lib/api/routesOps";

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

const eligibilityChecks = [
  { key: "route", status: "passed" as const },
  { key: "provider", status: "passed" as const },
  { key: "channel", status: "passed" as const },
  { key: "margin", status: "passed" as const },
  { key: "provider_breaker", status: "passed" as const },
  { key: "channel_breaker", status: "passed" as const },
  { key: "cooldown", status: "passed" as const },
  { key: "model_permission", status: "passed" as const },
  { key: "runtime", status: "passed" as const },
];

function runtimeChannel(
  overrides: Partial<RouteRuntimeChannel> = {},
): RouteRuntimeChannel {
  return {
    channel_id: 8,
    channel_name: "备用渠道",
    channel_status: "enabled",
    provider: { id: 4, name: "Backup Provider", status: "enabled" },
    protocol: "openai",
    adapter_key: "openai",
    priority: 0,
    order: 1,
    eligibility: {
      status: "eligible",
      reasons: [],
      checks: eligibilityChecks,
    },
    runtime: {
      state: "active",
      config_synchronized: true,
      breaker_store_admission: "normal",
      capacity_read_failed: false,
    },
    concurrency: {
      used: 1,
      limit: 10,
      remaining: 9,
      remaining_pct: 0.9,
      unlimited: false,
      metric_score: 90,
      contribution: 18,
    },
    quality: {
      ttft: {
        has_samples: true,
        value: 820,
        sample_count: 18,
        metric_score: 97.5,
        contribution: 24.375,
      },
      error_rate: {
        has_samples: true,
        value: 2,
        sample_count: 20,
        metric_score: 96,
        contribution: 19.2,
      },
    },
    traffic: {
      rpm: 120,
      rpd: 300,
      tpm: 25_000,
      token_covered_attempts: 16,
      token_coverage_pct: 80,
    },
    score: {
      algorithm_version: "objective_v1",
      total: 90.575,
      cost_ratio: 0.2,
      priority: 0,
      cost: { metric_score: 80, weight_pct: 25, contribution: 20 },
      concurrency: { metric_score: 90, weight_pct: 20, contribution: 18 },
      ttft: { metric_score: 97.5, weight_pct: 25, contribution: 24.375 },
      error_rate: { metric_score: 96, weight_pct: 20, contribution: 19.2 },
      priority_score: { metric_score: 90, weight_pct: 10, contribution: 9 },
    },
    distribution: {
      selected_1m: 8,
      selected_5m: 31,
      selected_share_1m: 0.8,
      selected_share_5m: 0.7,
      fallback_1m: 1,
    },
    internal_diagnostics: {
      origin_revision: 3,
      runtime_origin_revision: 3,
      provider_status_revision: 4,
      runtime_provider_status_revision: 4,
      channel_config_revision: 5,
      runtime_channel_config_revision: 5,
      channel_capacity_revision: 6,
      runtime_channel_capacity_revision: 6,
      global_concurrency_revision: 8,
      circuit_breaker_revision: 9,
      routing_balance_revision: 10,
      runtime_control_state: "active",
    },
    ...overrides,
  };
}

function noSampleQuality() {
  return {
    ttft: {
      has_samples: false,
      value: null,
      sample_count: 0,
      metric_score: 100,
      contribution: 25,
    },
    error_rate: {
      has_samples: false,
      value: null,
      sample_count: 0,
      metric_score: 100,
      contribution: 20,
    },
  };
}

function runtimeFixture(state: RuntimeState, observedAt: string): RouteRuntime {
  const denied = state === "store_unavailable";
  const unavailableRuntime: RouteRuntimeChannel["runtime"] = {
    state: "store_unavailable",
    config_synchronized: false,
    breaker_store_admission: "denied",
    capacity_read_failed: true,
  };
  const unavailableEligibility: RouteRuntimeChannel["eligibility"] = {
    status: "excluded",
    primary_reason: "runtime_sync_required",
    reasons: ["runtime_sync_required"],
    checks: eligibilityChecks.map((check) =>
      check.key === "runtime"
        ? { key: check.key, status: "failed", reason: "runtime_sync_required" }
        : check,
    ),
  };

  const backup = runtimeChannel(
    denied
      ? {
          runtime: unavailableRuntime,
          eligibility: unavailableEligibility,
          quality: noSampleQuality(),
          order: 0,
        }
      : {},
  );
  const primary = runtimeChannel({
    channel_id: 7,
    channel_name: "主渠道",
    provider: { id: 3, name: "Primary Provider", status: "enabled" },
    priority: 10,
    order: denied ? 0 : 2,
    eligibility: denied
      ? unavailableEligibility
      : {
          status: "excluded",
          primary_reason: "provider_breaker_open",
          reasons: ["provider_breaker_open", "model_permission_paused"],
          checks: eligibilityChecks.map((check) => {
            if (check.key === "provider_breaker") {
              return {
                key: check.key,
                status: "failed" as const,
                reason: "provider_breaker_open",
              };
            }
            if (check.key === "model_permission") {
              return {
                key: check.key,
                status: "failed" as const,
                reason: "model_permission_paused",
              };
            }
            return check;
          }),
        },
    runtime: denied ? unavailableRuntime : runtimeChannel().runtime,
    quality: denied ? noSampleQuality() : runtimeChannel().quality,
  });
  const stale = runtimeChannel({
    channel_id: 9,
    channel_name: "版本落后渠道",
    provider: { id: 5, name: "Stale Provider", status: "enabled" },
    priority: 20,
    order: denied ? 0 : 3,
    eligibility: denied
      ? unavailableEligibility
      : {
          status: "excluded",
          primary_reason: "stale",
          reasons: ["stale"],
          checks: eligibilityChecks.map((check) =>
            check.key === "runtime"
              ? { key: check.key, status: "failed", reason: "stale" }
              : check,
          ),
        },
    runtime: denied
      ? unavailableRuntime
      : {
          state: "stale",
          config_synchronized: false,
          breaker_store_admission: "denied",
          capacity_read_failed: false,
        },
    quality: noSampleQuality(),
    score: {
      ...runtimeChannel().score,
      total: 0,
      ttft: { metric_score: 100, weight_pct: 25, contribution: 25 },
      error_rate: { metric_score: 100, weight_pct: 20, contribution: 20 },
    },
    internal_diagnostics: {
      ...runtimeChannel().internal_diagnostics,
      channel_config_revision: 6,
      runtime_channel_config_revision: 5,
      runtime_control_state: denied ? "store_unavailable" : "stale",
    },
  });

  return {
    source_status: {
      state,
      breaker_store_admission: denied ? "denied" : "normal",
      observed_at: observedAt,
      stale: false,
      sources: [
        { name: "postgres", available: true, observed_at: observedAt, stale: false },
        {
          name: "breaker_store",
          available: !denied,
          observed_at: denied ? null : observedAt,
          stale: denied,
        },
      ],
    },
    route_summary: {
      route_id: routeID,
      mode: "balanced",
      status: "enabled",
      pool_size: 3,
      candidate_count: denied ? 0 : 1,
      no_redundancy: true,
      all_capacity_full: false,
      usage: denied
        ? null
        : { concurrency: 2, rpm: 240, rpd: 600, tpm: 50_000, active_users: 2 },
    },
    filters: { model_id: "gpt-p4", protocol: "openai" },
    channels: [backup, primary, stale],
    score_config: {
      algorithm_version: "objective_v1",
      revision: 10,
      cost_weight_pct: 25,
      concurrency_weight_pct: 20,
      ttft_weight_pct: 25,
      error_rate_weight_pct: 20,
      priority_weight_pct: 10,
      ttft_penalty_unit_ms: 1_000,
      ttft_penalty_points_per_unit: 2.5,
      error_penalty_points_per_percent: 2,
    },
    sample_window: {
      ttft_window_ms: 1_800_000,
      error_window_ms: 1_800_000,
      started_at: new Date(Date.parse(observedAt) - 1_800_000).toISOString(),
      ended_at: observedAt,
      available: !denied,
    },
  };
}

async function mockRouteOperations(page: Page, state: RuntimeState) {
  const observedAt = new Date().toISOString();
  await page.route(apiPattern, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await fulfillJSON(route, null, 204);
      return;
    }

    const path = new URL(request.url()).pathname;
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
          concurrency_limit: 12,
          description: "Provider 全局运行态",
          channels: [
            { channel_id: 7, channel_name: "主渠道", provider_id: 3, provider_slug: "starapi" },
            { channel_id: 8, channel_name: "备用渠道", provider_id: 4, provider_slug: "relayapi" },
            { channel_id: 9, channel_name: "版本落后渠道", provider_id: 5, provider_slug: "staleapi" },
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
      await fulfillJSON(route, { data: runtimeFixture(state, observedAt) });
      return;
    }
    if (path === "/admin/v1/requests") {
      await fulfillJSON(route, { data: [], meta: { total: 0 } });
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
            provider_routing: { nonterminal_count: 0, oldest_age_seconds: null },
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
            key: "gateway.concurrency_defaults",
            category: "gateway",
            label: "在途并发全局默认",
            description: "线路用户并发与渠道并发默认值。",
            hot_reload: true,
            default: { key_limit: 0, channel_limit: 0 },
            value: { key_limit: 0, channel_limit: 0 },
            source: "redis",
            revision: 6,
            runtime_active_revision: 6,
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("unio_admin_token", "p4-e2e-token");
  });
});

test("shows objective candidate order, observations, and structured detail", async ({ page }) => {
  await mockRouteOperations(page, "active");
  await page.goto(`/routes/${routeID}`);

  await expect(page.getByRole("tab", { name: "实时路由" })).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新区间数据" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "自动刷新已开启，点击刷新实时路由" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新列表" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "候选顺序表" })).toBeVisible();
  const candidateTable = page.getByRole("table").filter({ hasText: "备用渠道" });
  await expect(candidateTable.getByRole("columnheader")).toHaveCount(10);

  const backup = page.getByRole("row", { name: /备用渠道/ });
  await expect(backup.getByText("Backup Provider", { exact: false })).toBeVisible();
  await expect(backup.getByText("820ms", { exact: true })).toBeVisible();
  await expect(backup.getByText("120 RPM", { exact: true })).toBeVisible();
  await expect(backup.getByText("90.58", { exact: true })).toBeVisible();
  await backup.getByRole("button", { name: "查看" }).click();

  let detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "备用渠道" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "五项评分" })).toBeVisible();
  await expect(detail.getByText("80 × 25% = 20", { exact: true })).toBeVisible();
  await expect(detail.getByText("820ms", { exact: true })).toBeVisible();
  await expect(detail.getByText("25,000", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "内部诊断" }).click();
  await expect(detail.getByText("routing_balance_revision", { exact: true })).toBeVisible();
  await expect(detail.getByText("10", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const primary = page.getByRole("row", { name: /主渠道/ });
  await expect(primary.getByText("无资格", { exact: true })).toBeVisible();
  await expect(primary.getByText("服务商熔断已打开", { exact: true })).toBeVisible();
  await primary.getByRole("button", { name: "查看" }).click();
  detail = page.getByRole("dialog");
  await expect(detail.getByText("服务商熔断", { exact: true })).toBeVisible();
  await expect(detail.getByText("模型权限暂停", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const stale = page.getByRole("row", { name: /版本落后渠道/ });
  await expect(stale.getByText("版本落后", { exact: true })).toBeVisible();
  await expect(stale.getByText("配置未同步", { exact: true })).toBeVisible();
  await expect(stale.getByText("无样本", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近 30 分钟评分样本" })).toBeVisible();
  const sampleToolbar = page.getByRole("toolbar");
  await expect(sampleToolbar.getByRole("combobox", { name: "筛选样本渠道" })).toBeVisible();
  await expect(sampleToolbar.getByRole("combobox", { name: "筛选评分维度" })).toBeVisible();
});

test("renders shared runtime failure as denied admission", async ({ page }) => {
  await mockRouteOperations(page, "store_unavailable");
  await page.goto(`/routes/${routeID}`);

  const alert = page.getByRole("alert").filter({ hasText: "基础设施故障" });
  await expect(alert.getByText("基础设施故障，准入已拒绝", { exact: true })).toBeVisible();
  await expect(alert.getByText("共享运行态不可用，当前准入已拒绝。", { exact: true })).toBeVisible();
  await expect(page.getByText("配置未同步", { exact: true })).toHaveCount(3);
  await expect(page.getByText("820ms", { exact: true })).toHaveCount(0);
});

test("keeps route limits and channel concurrency while channel rates are observational", async ({ page }) => {
  await mockRuntimeSettings(page);
  await page.goto("/system");

  await expect(
    page.getByText(
      "四个关键运行态控制以 Redis 激活版本为执行依据；其他网关设置由 applier 在约 5 秒内热更新",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/^线路默认限流\(RPM\/TPM\/RPD\)/)).toBeVisible();
  await expect(page.getByText("线路限流命中后直接返回 429", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/渠道级 RPM、RPD、TPM\s*只作观测，不参与拦截和评分。/),
  ).toBeVisible();
  await expect(page.getByText(/^在途并发全局默认/)).toBeVisible();
  await expect(page.getByText("线路用户并发（0=不限）", { exact: true })).toBeVisible();
  await expect(page.getByText("渠道并发（0=不限）", { exact: true })).toBeVisible();
  await expect(page.getByText(/^渠道默认限流\(RPM\/TPM\/RPD\)/)).toHaveCount(0);
});
