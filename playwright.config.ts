import { defineConfig } from "@playwright/test";

const pythonCommand = process.env.PYTHON_BIN ?? (process.platform === "win32" ? "python" : "python3");

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8000",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${pythonCommand} scripts/dev.py`,
    url: "http://127.0.0.1:8000/api?action=health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
