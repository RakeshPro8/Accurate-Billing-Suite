import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.browser\.test\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4177",
    trace: "retain-on-failure",
  },
  outputDir: "test-results/print-preview",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], browserName: "firefox" },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], browserName: "webkit" },
    },
  ],
  webServer: {
    command:
      "PORT=4177 BASE_PATH=/ pnpm --filter @workspace/billing-app run dev",
    url: "http://127.0.0.1:4177/print-preview-harness.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
