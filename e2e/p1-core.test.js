describe('Kindcipe P1 Core Test', () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  beforeAll(async () => {
    if (!email || !password) {
      throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running Detox.');
    }

    await device.launchApp({ newInstance: true, delete: true });
    
    // Login once
    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();

    await waitFor(element(by.text('今晚食咩好？')))
      .toBeVisible()
      .withTimeout(30000);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // Scenario 5: Add to Meal Plan
  it('Scenario 5: adds recipe to meal plan', async () => {
    await device.launchApp({ newInstance: false, url: 'kindcipe://ai-chef' });

    await waitFor(element(by.id('ai-chef-input')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('ai-chef-input')).tap();
    await element(by.id('ai-chef-input')).typeText('番茄炒蛋');
    await element(by.id('ai-chef-send')).tap();

    await waitFor(element(by.id('recipe-card-0')))
      .toBeVisible()
      .withTimeout(90000);

    await element(by.id('recipe-card-add-to-planner-0')).tap();

    await waitFor(element(by.text('本週餐單')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('planner-meal-item'))).toBeVisible();
  });

  // Scenario 6: Add to Shopping List
  it('Scenario 6: adds ingredients to shopping list', async () => {
    await device.launchApp({ newInstance: false, url: 'kindcipe://shopping' });

    await waitFor(element(by.id('shopping-list')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('shopping-add-item')).tap();
    await element(by.id('shopping-item-input')).typeText('雞蛋');
    await element(by.id('shopping-item-confirm')).tap();

    await waitFor(element(by.text('雞蛋')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // Scenario 7: Toggle Bought
  it('Scenario 7: toggles shopping item as bought', async () => {
    await device.launchApp({ newInstance: false, url: 'kindcipe://shopping' });

    await waitFor(element(by.id('shopping-list')))
      .toBeVisible()
      .withTimeout(30000);

    const firstItem = element(by.id('shopping-item-0'));
    await waitFor(firstItem).toBeVisible().withTimeout(10000);
    
    await firstItem.tap();

    await waitFor(firstItem)
      .toHaveAttribute('accessibilityState', 'checked')
      .withTimeout(5000);
  });

  // Scenario 8: Family Create/Join
  it('Scenario 8: creates or joins family', async () => {
    await device.launchApp({ newInstance: false, url: 'kindcipe://family' });

    await waitFor(element(by.id('family-screen')))
      .toBeVisible()
      .withTimeout(30000);

    const createButton = element(by.id('family-create'));
    const joinButton = element(by.id('family-join'));

    if (await createButton.exists()) {
      await createButton.tap();
      await waitFor(element(by.id('family-code-display')))
        .toBeVisible()
        .withTimeout(10000);
    } else if (await joinButton.exists()) {
      await joinButton.tap();
      await element(by.id('family-code-input')).typeText('TEST123');
      await element(by.id('family-join-confirm')).tap();
    }
  });

  // Scenario 9: Pantry Add
  it('Scenario 9: adds item to pantry', async () => {
    await device.launchApp({ newInstance: false, url: 'kindcipe://pantry' });

    await waitFor(element(by.id('pantry-screen')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('pantry-add-item')).tap();
    await element(by.id('pantry-item-name')).typeText('大米');
    await element(by.id('pantry-item-quantity')).typeText('1');
    await element(by.id('pantry-item-unit')).typeText('kg');
    await element(by.id('pantry-item-confirm')).tap();

    await waitFor(element(by.text('大米')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // Scenario 10: Cold Relaunch / Deep Link
  it('Scenario 10: handles cold relaunch and deep link', async () => {
    await device.launchApp({ newInstance: true, url: 'kindcipe://ai-chef' });

    await waitFor(element(by.id('ai-chef-input')))
      .toBeVisible()
      .withTimeout(30000);

    await expect(element(by.id('ai-chef-input'))).toBeVisible();
  });
});
