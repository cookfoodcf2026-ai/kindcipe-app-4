/**
 * E2E test: verify that cold-start deep links are NOT silently redirected to /.
 *
 * Run: npx playwright test e2e/web-router-auth.spec.ts
 * Prerequisite: npx expo export --platform web (outputs dist/)
 * Server: npx serve dist -p 3000
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

const routes = [
  { path: "/recipe/official_3674", desc: "deep link recipe" },
  { path: "/settings", desc: "settings page" },
  { path: "/login?next=%2Fshopping&utm_source=test", desc: "login with next + utm" },
  { path: "/nonexistent-xyz", desc: "unknown path (404 ok, must NOT become /)" },
];

for (const { path, desc } of routes) {
  test(`cold-open ${desc} should NOT redirect pathname to /`, async ({ page }) => {
    const url = `${BASE_URL}${path}`;
    const expectedPathname = path.split("?")[0];
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait for hydration / initial routing to settle
    await page.waitForTimeout(3_000);
    const pathname = new URL(await page.url()).pathname;
    expect(pathname).not.toBe("/");
    // /nonexistent may become a 404 page but must NOT become /
    if (expectedPathname === "/nonexistent-xyz") {
      expect(pathname).toMatch(/nonexistent|not.?found|404|error/i);
    }
  });
}
