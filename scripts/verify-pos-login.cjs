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

  // 1. Login
  console.log('=== 1. LOGIN ===');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('input[type="text"], input[type="email"], input[placeholder*="ser"]', { timeout: 10000 }).catch(() => {});
  const inputs = await page.$$('input');
  console.log('Input fields found:', inputs.length);
  // fill identity (first text input) and password
  if (inputs.length >= 2) {
    await inputs[0].fill('yon');
    await inputs[1].fill('Bismillah1');
  }
  await page.click('button:has-text("Masuk"), button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('URL after login:', page.url());

  // 2. Navigate POS
  console.log('=== 2. POS PAGE ===');
  if (!page.url().includes('/pos')) {
    await page.goto('http://127.0.0.1:5173/pos', { waitUntil: 'load', timeout: 30000 });
  }
  await page.waitForTimeout(5000);

  const title = await page.title();
  const finalUrl = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log('Title:', title);
  console.log('Final URL:', finalUrl);
  console.log('Body snippet:\n' + bodyText);
  console.log('Console errors:', errors.length);
  if (errors.length) console.log(errors);

  // 3. Count visible buttons / cards
  const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Buttons:', buttons.slice(0, 20));
  const cards = await page.$$eval('[class*="card"], [class*="product"], [class*="feed"]', els => els.length);
  console.log('Card-like elements:', cards);

  // 4. Mobile viewport check
  console.log('=== 3. MOBILE VIEWPORT ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.offsetWidth,
    scrollW: document.documentElement.scrollWidth,
    hasOverflow: document.documentElement.scrollWidth > document.documentElement.offsetWidth
  }));
  console.log('Mobile overflow:', overflow);

  console.log('=== AUDIT DONE ===');
  await context.close();
  await browser.close();
})().catch(e => {
  console.error('AUDIT ERR:', e);
  process.exit(1);
});
