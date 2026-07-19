import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_ADMIN_URL
    ? undefined
    : {
        command: "bun run dev -- --host 127.0.0.1 --port 5173",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
