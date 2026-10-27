import { test, expect } from "@playwright/test";

test("typography fixture stays on the system sans stack", async ({ page }) => {
  await page.goto("/visual-typography");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot("typography-fixture.png", { fullPage: true, animations: "disabled", timeout: 15000 });
  await page.getByTestId("visual-recipe").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("visual-recipe")).toHaveScreenshot("recipe-card-type.png", { animations: "disabled", timeout: 15000 });

  const moreFont = await page.getByTestId("visual-more-title").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(moreFont.toLowerCase()).toContain("system-ui");
  expect(moreFont.toLowerCase()).not.toContain("times");
});
