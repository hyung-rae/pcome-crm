import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile(".env.local");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8888";

export default defineConfig({
  globalSetup: "./tests/auth-setup.ts",
  globalTeardown: "./tests/auth-teardown.ts",
  workers: 2,
  testDir: "./tests",
  testIgnore: "**/password-validation.spec.ts",
  fullyParallel: true,
  use: {
    baseURL,
    storageState: `${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/admin.json`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 8888",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
