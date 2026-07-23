import { expect, test, type Page, type Route } from "@playwright/test";

const apiPattern = "**/admin/v1/**";

type EndpointSummary = {
  id: number;
  name: string;
  base_url: string;
  status: string;
};

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
  const endpoints = new Map<number, EndpointSummary[]>([
    [
      1,
      [
        {
          id: 11,
          name: "Primary",
          base_url: "https://primary.example.com/v1",
          status: "enabled",
        },
        {
          id: 12,
          name: "Backup",
          base_url: "https://backup.example.com/v1",
          status: "disabled",
        },
        {
          id: 13,
          name: "Legacy",
          base_url: "https://legacy.example.com/v1",
          status: "archived",
        },
      ],
    ],
    [2, []],
  ]);
  let listCalls = 0;
  let createdProviderID: number | null = null;

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await fulfillJSON(route, null, 204);
      return;
    }

    const path = new URL(request.url()).pathname;
    if (path === "/admin/v1/providers/ops" && request.method() === "GET") {
      listCalls++;
      const createdAt = "2026-07-23T12:00:00Z";
      await fulfillJSON(route, {
        data: [
          {
            id: 1,
            slug: "starapi",
            name: "StarAPI",
            status: "enabled",
            created_at: createdAt,
            endpoints: endpoints.get(1),
            channel_total: 0,
            models_count: 0,
            routes_count: 0,
          },
          {
            id: 2,
            slug: "empty-ai",
            name: "EmptyAI",
            status: "enabled",
            created_at: createdAt,
            endpoints: endpoints.get(2),
            channel_total: 0,
            models_count: 0,
            routes_count: 0,
          },
          {
            id: 3,
            slug: "legacy-response",
            name: "LegacyResponse",
            status: "enabled",
            created_at: createdAt,
            channel_total: 0,
            models_count: 0,
            routes_count: 0,
          },
          {
            id: 4,
            slug: "archived-ai",
            name: "ArchivedAI",
            status: "archived",
            created_at: createdAt,
            endpoints: [],
            channel_total: 0,
            models_count: 0,
            routes_count: 0,
          },
        ],
        meta: { page: 1, page_size: 20, total: 4, total_pages: 1 },
      });
      return;
    }

    if (path === "/admin/v1/provider-endpoints" && request.method() === "POST") {
      const input = request.postDataJSON() as {
        provider_id: number;
        name: string;
        base_url: string;
        status: string;
      };
      createdProviderID = input.provider_id;
      const endpoint = {
        id: 21,
        provider_id: input.provider_id,
        provider_name: "EmptyAI",
        name: input.name,
        base_url: input.base_url,
        base_url_revision: 1,
        status: input.status,
        status_revision: 1,
        channel_count: 0,
        runtime_sync_pending: false,
        runtime_sync_state: "active",
        runtime_active_base_url_revision: 1,
        runtime_pending_base_url_revision: null,
        runtime_active_status_revision: 1,
        runtime_pending_status_revision: null,
        runtime_effective_status: input.status,
        archived_at: null,
        created_at: "2026-07-23T12:01:00Z",
        updated_at: "2026-07-23T12:01:00Z",
      };
      endpoints.get(input.provider_id)?.push(endpoint);
      await fulfillJSON(route, { data: endpoint }, 201);
      return;
    }

    await fulfillJSON(route, { error: { message: `unmocked ${path}` } }, 404);
  });

  return {
    get listCalls() {
      return listCalls;
    },
    get createdProviderID() {
      return createdProviderID;
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("unio_admin_token", "provider-e2e-token");
  });
});

test("shows Endpoint facts and creates one from the row menu", async ({
  page,
}) => {
  const state = await mockProviders(page);
  await page.goto("/providers");

  await expect(page.getByRole("columnheader", { name: "端点" })).toBeVisible();
  const starAPI = page.getByRole("row", { name: /StarAPI/ });
  await expect(starAPI.getByText("Primary", { exact: true })).toBeVisible();
  await expect(starAPI.getByText("https://primary.example.com/v1", { exact: true })).toBeVisible();
  await expect(starAPI.getByText("Backup", { exact: true })).toBeVisible();
  await starAPI.getByRole("button", { name: "另有 1 个端点" }).click();
  await expect(page.getByText("Legacy", { exact: true })).toBeVisible();
  await expect(page.getByText("https://legacy.example.com/v1", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const emptyAI = page.getByRole("row", { name: /EmptyAI/ });
  await expect(emptyAI.getByText("暂无端点", { exact: true })).toBeVisible();
  const legacyResponse = page.getByRole("row", { name: /LegacyResponse/ });
  await expect(legacyResponse.getByText("暂无端点", { exact: true })).toBeVisible();
  const archivedAI = page.getByRole("row", { name: /ArchivedAI/ });
  await archivedAI.getByRole("button", { name: "更多" }).hover();
  await expect(page.getByRole("menuitem", { name: "新建端点" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await emptyAI.getByRole("button", { name: "更多" }).hover();
  await page.getByRole("menuitem", { name: "新建端点" }).click();

  const dialog = page.getByRole("dialog", { name: "新建端点" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#endpoint_name").fill("Primary");
  await dialog.locator("#endpoint_base_url").fill("https://empty.example.com/v1");
  await dialog.getByRole("button", { name: "创建" }).click();

  await expect(dialog).toBeHidden();
  await expect(emptyAI.getByText("Primary", { exact: true })).toBeVisible();
  await expect(emptyAI.getByText("https://empty.example.com/v1", { exact: true })).toBeVisible();
  expect(state.createdProviderID).toBe(2);
  expect(state.listCalls).toBeGreaterThanOrEqual(2);
});
