import { defineConfig } from "@playwright/test";

// Pure functions only: no env file, server, browser or remote auth setup.
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/password-validation.spec.ts",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
});
