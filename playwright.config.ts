import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "bi-functional.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8000",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "\"C:\\Users\\aniba\\AppData\\Local\\Programs\\Python\\Python314\\python.exe\" scripts/dev.py",
    url: "http://127.0.0.1:8000/api?action=health",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
