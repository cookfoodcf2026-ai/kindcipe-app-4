describe("Kindcipe AI Chef smoke", () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  it("logs in and sends an AI Chef prompt", async () => {
    if (!email || !password) {
      throw new Error("Set E2E_EMAIL and E2E_PASSWORD before running Detox.");
    }

    await device.launchApp({ newInstance: true, delete: true });

    await expect(element(by.id("login-email"))).toBeVisible();
    await element(by.id("login-email")).typeText(email);
    await element(by.id("login-password")).typeText(password);
    await element(by.id("login-submit")).tap();

    await waitFor(element(by.text("今晚食咩好？")))
      .toBeVisible()
      .withTimeout(60000);

    await device.launchApp({ newInstance: false, url: "kindcipe://ai-chef" });

    await waitFor(element(by.id("ai-chef-input")))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id("ai-chef-input")).tap();
    await element(by.id("ai-chef-input")).typeText("請提供一個 20 分鐘內完成的番茄炒蛋食譜");
    await element(by.id("ai-chef-send")).tap();

    await waitFor(element(by.text("收藏")))
      .toBeVisible()
      .withTimeout(90000);
  });
});
