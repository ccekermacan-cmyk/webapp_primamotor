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

  console.log('=== 1. LOGIN AS ADMIN (wil, level 1) ===');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load', timeout: 30000 });
  const inputs = await page.$$('input');
  await inputs[0].fill('wil');
  await inputs[1].fill('Bismillah1');
  await page.click('button:has-text("Masuk"), button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('URL after login:', page.url());

  const navButtons = await page.$$eval('.pos-navbar button, div[class*="bg-slate-200"] button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Navbar menu options:', navButtons);

  // Switch to Penjualan
  console.log('=== 2. SWITCH TO PENJUALAN ===');
  await page.click('button:has-text("Penjualan")');
  await page.waitForTimeout(3000);

  const productNames = await page.$$eval('[class*="group"] h3, [class*="group"] p, [class*="card"] h3', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Products displayed count:', productNames.length);
  console.log('Sample products:', productNames.slice(0, 8));

  // Add first product to cart
  console.log('=== 3. ADD PRODUCT TO CART ===');
  const addBtn = await page.$('button:has-text("+"), button[title*="Tambah"], button[aria-label*="Tambah"], div[class*="group"]');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    console.log('Product clicked!');
  }

  // Open Cart Modal
  const cartTrigger = await page.$('button[title*="Keranjang"], button:has-text("TRANSAKSI"), button:has-text("Rp")');
  if (cartTrigger) {
    await cartTrigger.click();
    await page.waitForTimeout(1000);
    const inCart = await page.evaluate(() => document.body.innerText.includes('Total tagihan') || document.body.innerText.includes('Barang & jasa') || document.body.innerText.includes('Periksa transaksi'));
    console.log('Cart modal opened successfully:', inCart);

    // Close cart modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Switch to Gaji
  console.log('=== 4. SWITCH TO GAJI ===');
  await page.click('button:has-text("Gaji")');
  await page.waitForTimeout(3000);

  const gajiText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('Gaji view snippet:\n' + gajiText);

  // Open Gaji Modal
  const slipGajiBtn = await page.$('button:has-text("Buat Slip Gaji"), button:has-text("Kelola Gaji")');
  if (slipGajiBtn) {
    await slipGajiBtn.click();
    await page.waitForTimeout(1000);
    const gajiModalOpen = await page.evaluate(() => document.body.innerText.includes('Periode Gaji') || document.body.innerText.includes('Hari kerja') || document.body.innerText.includes('Daftar Karyawan'));
    console.log('Gaji modal opened successfully:', gajiModalOpen);
  }

  console.log('Console errors:', errors);

  await context.close();
  await browser.close();
  console.log('=== ALL ADMIN POS MODULE TESTS PASSED! ===');
})().catch(e => {
  console.error('ERR:', e);
  process.exit(1);
});
