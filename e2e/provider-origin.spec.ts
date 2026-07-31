import { expect, test, type Page, type Route } from "@playwright/test";

const apiPattern = "**/admin/v1/**";

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

async function mockProviders(page: Page) {
  let provider = {
    id: 1,
    slug: "starapi",
    name: "StarAPI",
    origin: "https://primary.example.com/v1",
    origin_revision: 3,
    status: "enabled",
    status_revision: 2,
    created_at: "2026-07-23T12:00:00Z",
    updated_at: "2026-07-23T12:00:00Z",
    archived_at: null,
    runtime_sync_pending: false,
  };
  const originWrites: Array<Record<string, unknown>> = [];

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await fulfillJSON(route, null, 204);
      return;
    }
    const path = new URL(request.url()).pathname;

    if (path === "/admin/v1/providers/ops" && request.method() === "GET") {
      await fulfillJSON(route, {
        data: [{
          id: provider.id,
          slug: provider.slug,
          name: provider.name,
          origin: provider.origin,
          origin_revision: provider.origin_revision,
          status: provider.status,
          status_revision: provider.status_revision,
          created_at: provider.created_at,
          channel_total: 2,
          models_count: 1,
          routes_count: 1,
        }],
        meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      });
      return;
    }
    if (path === "/admin/v1/providers" && request.method() === "GET") {
      await fulfillJSON(route, { data: [provider], meta: { total: 1 } });
      return;
    }
    if (path === "/admin/v1/providers/1/ops/detail") {
      await fulfillJSON(route, { data: {
        channel_total: 2,
        channel_enabled: 2,
        attempt_total: 10,
        attempt_succeeded: 10,
        success_rate: 1,
        timeout_total: 0,
        latency: { avg: 100, p50: 90, p95: 130, p99: 150 },
        tokens: 100,
        revenue_usd: "1.00",
        cost_usd: "0.50",
        margin_usd: "0.50",
        avg_tps: 20,
      } });
      return;
    }
    if (path === "/admin/v1/providers/1/ops/runtime") {
      await fulfillJSON(route, { data: {
        id: 1,
        origin_revision: provider.origin_revision,
        status_revision: provider.status_revision,
        effective_status: provider.status,
        origin_revision_state: "active",
        status_revision_state: "active",
        pending_origin_revision: 0,
        pending_status_revision: 0,
        state: "closed",
        state_generation: 4,
        runtime_sync_state: "active",
      } });
      return;
    }
    if (path === "/admin/v1/providers/1/origin" && request.method() === "PATCH") {
      const input = request.postDataJSON() as Record<string, unknown>;
      originWrites.push(input);
      if (input.confirm_enabled_channels !== true) {
        await fulfillJSON(route, { error: { message: "confirmation required" } }, 409);
        return;
      }
      provider = {
        ...provider,
        origin: String(input.origin),
        origin_revision: provider.origin_revision + 1,
        updated_at: "2026-07-23T12:01:00Z",
      };
      await fulfillJSON(route, { data: provider });
      return;
    }
    if (path.includes("/ops/channels")) {
      await fulfillJSON(route, { data: [] });
      return;
    }
    if (path.includes("/ops/performance")) {
      await fulfillJSON(route, { data: [] });
      return;
    }
    if (path.includes("/ops/errors")) {
      await fulfillJSON(route, { data: [], meta: { total: 0 } });
      return;
    }

    await fulfillJSON(route, { error: { message: `unmocked ${path}` } }, 404);
  });

  return { originWrites };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("unio_admin_token", "provider-e2e-token");
  });
});

test("shows Provider origin and confirms enabled Channel cutover", async ({ page }) => {
  const state = await mockProviders(page);
  await page.goto("/providers");

  await expect(page.getByRole("columnheader", { name: "API Root" })).toBeVisible();
  const providerRow = page.getByRole("row", { name: /StarAPI/ });
  await expect(providerRow.getByText("https://primary.example.com/v1")).toBeVisible();
  await expect(providerRow.getByText("origin v3 · status v2")).toBeVisible();

  await providerRow.getByRole("link", { name: "查看", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "配置与运行态", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("https://primary.example.com/v1", { exact: true })).toBeVisible();
  await expect(page.getByText("v3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "修改 API Root" }).click();
  const dialog = page.getByRole("dialog", { name: "修改 Provider API Root" });
  await dialog.getByLabel("API Root").fill("https://next.example.com/v1");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog.getByText("确认启用渠道切换地址")).toBeVisible();
  await dialog.getByRole("button", { name: "确认切换" }).click();

  await expect(dialog).toBeHidden();
  expect(state.originWrites).toEqual([
    {
      origin: "https://next.example.com/v1",
      expected_origin_revision: 3,
      confirm_enabled_channels: false,
    },
    {
      origin: "https://next.example.com/v1",
      expected_origin_revision: 3,
      confirm_enabled_channels: true,
    },
  ]);
});
