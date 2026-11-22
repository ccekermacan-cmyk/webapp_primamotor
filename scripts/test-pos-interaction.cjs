const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('ws://127.0.0.1:9222/');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load', timeout: 30000 });
  const inputs = await page.$$('input');
  await inputs[0].fill('yon');
  await inputs[1].fill('Bismillah1');
  await page.click('button:has-text("Masuk"), button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('=== Filter dropdown open ===');
  const filterBtn = await page.$('button:has-text("FILTER")');
  if (filterBtn) {
    await filterBtn.click();
    await page.waitForTimeout(500);
    const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
    console.log('Buttons after FILTER:', buttons.slice(0, 30));
  }

  console.log('=== Click Penjualan ===');
  await page.click('button:has-text("Penjualan")');
  await page.waitForTimeout(5000);

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log('Console errors:', errors.length);
  if (errors.length) console.log('Errors:', errors);
  console.log('Body snippet:\n' + bodyText);

  const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Buttons (first 40):', buttons.slice(0, 40));

  await context.close();
  await browser.close();
  console.log('=== DONE ===');
})().catch(e => {
  console.error('ERR:', e);
  process.exit(1);
});
