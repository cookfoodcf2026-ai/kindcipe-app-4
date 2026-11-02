const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = b.contexts()[0];
  let page = ctx.pages()[0];
  if (!page) page = await ctx.newPage();
  await page.goto('https://app.kindcipe.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('TEXT:', txt.replace(/\n+/g, ' | '));
  const keys = await page.evaluate(() => Object.keys(localStorage));
  console.log('LS:', JSON.stringify(keys));
  await page.screenshot({ path: '/tmp/cdp_shot1.png' });
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
