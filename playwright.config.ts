import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/visual",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8081",
    ...devices["iPhone 13"],
    colorScheme: "light",
  },
  webServer: {
    command: "EXPO_PUBLIC_VISUAL_TEST=1 npx expo start --web --port 8081",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
