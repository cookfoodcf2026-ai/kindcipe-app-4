describe('Kindcipe P0 Smoke Test', () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  beforeEach(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.reloadReactNative();
  });

  // Scenario 1: Email Login
  it('Scenario 1: logs in with email', async () => {
    if (!email || !password) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running Detox.');
    }

    await expect(element(by.id('login-email'))).toBeVisible();
    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();

    await waitFor(element(by.text('今晚食咩好？')))
      .toBeVisible()
      .withTimeout(30000);
  });

  // Scenario 2: Biometric Prompt
  it('Scenario 2: handles biometric prompt', async () => {
    if (!email || !password) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running Detox.');
    }

    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();

    try {
      await waitFor(element(by.id('biometric-skip')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('biometric-skip')).tap();
    } catch {
      // Biometric prompt may not appear - acceptable
    }

    await waitFor(element(by.text('今晚食咩好？')))
      .toBeVisible()
      .withTimeout(30000);
  });

  // Scenario 3: AI Chef Generation
  it('Scenario 3: generates recipe via AI Chef', async () => {
    if (!email || !password) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running Detox.');
    }

    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();

    await waitFor(element(by.text('今晚食咩好？')))
      .toBeVisible()
      .withTimeout(30000);

    await device.launchApp({ newInstance: false, url: 'kindcipe://ai-chef' });

    await waitFor(element(by.id('ai-chef-input')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('ai-chef-input')).tap();
    await element(by.id('ai-chef-input')).typeText('請提供一個 20 分鐘內完成的番茄炒蛋食譜');
    await element(by.id('ai-chef-send')).tap();

    await waitFor(element(by.id('recipe-card-0')))
      .toBeVisible()
      .withTimeout(90000);

    await expect(element(by.id('recipe-card-name-0'))).toBeVisible();
  });

  // Scenario 4: Recipe Card Render
  it('Scenario 4: renders recipe card with steps and ingredients', async () => {
    if (!email || !password) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running Detox.');
    }

    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();

    await waitFor(element(by.text('今晚食咩好？')))
      .toBeVisible()
      .withTimeout(30000);

    await device.launchApp({ newInstance: false, url: 'kindcipe://ai-chef' });

    await waitFor(element(by.id('ai-chef-input')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('ai-chef-input')).tap();
    await element(by.id('ai-chef-input')).typeText('請提供一個 20 分鐘內完成的番茄炒蛋食譜');
    await element(by.id('ai-chef-send')).tap();

    await waitFor(element(by.id('recipe-card-0')))
      .toBeVisible()
      .withTimeout(90000);

    await expect(element(by.id('recipe-card-name-0'))).toBeVisible();
    await expect(element(by.id('recipe-card-steps-count-0'))).toBeVisible();
    
    await element(by.id('recipe-card-ingredients-toggle-0')).tap();
    
    await waitFor(element(by.id('recipe-card-ingredients-0')))
      .toBeVisible()
      .withTimeout(10000);
    
    await waitFor(element(by.id('recipe-card-steps-content-0')))
      .toBeVisible()
      .withTimeout(10000);
    
    await expect(element(by.id('recipe-card-first-step-0'))).toBeVisible();
    await expect(element(by.id('ai-chef-recipe-0-favorite'))).toBeVisible();
  });
});
