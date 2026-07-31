import { expect, test } from "@playwright/test";

const adminToken = process.env.E2E_ADMIN_TOKEN;
const routeID = process.env.E2E_ROUTE_ID;

test.describe("P3 routing operations", () => {
  test.skip(!adminToken || !routeID, "E2E_ADMIN_TOKEN and E2E_ROUTE_ID are required");

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem("unio_admin_token", token);
    }, adminToken!);
  });

  test("shows live candidate order and scoring samples", async ({ page }) => {
    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes(`/admin/v1/routes/${routeID}/ops/runtime`),
    );
    await page.goto(`/routes/${routeID}`);

    await expect(page.getByRole("tab", { name: "实时路由" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "候选顺序表" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "最近 30 分钟评分样本" }),
    ).toBeVisible();

    const response = await runtimeResponse;
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.data.route_summary.pool_size).toBeGreaterThan(0);
    expect(Array.isArray(payload.data.channels)).toBeTruthy();
    expect(payload.data.source_status.state).toBeTruthy();
  });
});
