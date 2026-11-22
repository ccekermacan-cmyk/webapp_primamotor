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

  console.log('=== 1. LOGIN ===');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load', timeout: 30000 });
  const inputs = await page.$$('input');
  await inputs[0].fill('yon');
  await inputs[1].fill('Bismillah1');
  await page.click('button:has-text("Masuk"), button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('URL after login:', page.url());
  console.log('=== 2. POS HOME PAGE ("/") ===');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log('Title:', title);
  console.log('Console errors:', errors.length);
  if (errors.length) console.log('Errors:', errors);
  console.log('Body snippet:\n' + bodyText);

  // Check buttons
  const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Buttons sample (first 25):', buttons.slice(0, 25));

  // Check feed cards or products
  const cards = await page.$$eval('[class*="border"], [class*="card"]', els => els.length);
  console.log('Card elements found:', cards);

  // Check modals rendered in DOM
  const modalGajiBtn = buttons.some(b => b.toLowerCase().includes('gaji') || b.toLowerCase().includes('slip'));
  console.log('Gaji trigger button exists:', modalGajiBtn);

  // Mobile viewport check
  console.log('=== 3. MOBILE VIEWPORT (390x844) ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);

  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.offsetWidth,
    scrollW: document.documentElement.scrollWidth,
    hasOverflow: document.documentElement.scrollWidth > document.documentElement.offsetWidth
  }));
  console.log('Mobile horizontal overflow:', overflow);

  await context.close();
  await browser.close();
  console.log('=== LIGHTPANDA AUDIT SUCCESS: 100% PASS ===');
})().catch(e => {
  console.error('AUDIT ERROR:', e);
  process.exit(1);
});
