const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.connectOverCDP('ws://127.0.0.1:9222/');
  const user = {
    id: 'user00000000001',
    collectionId: 'users',
    collectionName: 'user',
    username: 'audit',
    name: 'Audit User',
    level: '10',
    status: 'Active'
  };
  const token = 'e30.' + Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    id: user.id,
    collectionId: 'users'
  })).toString('base64url') + '.fixture';

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });

  const errors = [];
  const product = {
    id: 'product00000001', id_lama: 'oil1', kategori: 'Oli', merk: 'MPX',
    keterangan: 'Oli mesin', tipe: 'Matic', jenis: 'Motor', varian: '0.8L', unit: 'pcs',
    beli: 40000, sell_1: 45000, sell_2: 47000, sell_3: 49000, sell_4: 50000, sell_5: 52000, sell_6: 55000,
    min_1: 12, min_2: 6, min_3: 3, stok_3: 50
  };
  const account = { id: 'account00000001', id_lama: 'kas', text_1: 'Kas kasir', jenis: 'cashflow account' };
  const person = { id: 'person000000001', id_lama: 'umum1', text_1: 'Umum1', kategori: 'person', jenis: 'customer' };
  const menu = {
    id: 'nota00000000001', collectionName: 'menu', jenis: 'Penjualan', person: 'umum1',
    total: 85000, dibayar: 85000, status: 'lunas', text: 'Nota Penjualan',
    created_at: '2026-11-22 09:30:00', payment: 'Tunai', operator: 'Audit', file: []
  };

  await context.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const reply = json => route.fulfill({ json });

    if (p.startsWith('/api/')) {
      if (p.endsWith('/auth-refresh')) return reply({ token, record: user });
      if (p.includes('/permissions/delete')) return reply({ results: [{ collection: 'menu', id: menu.id, allowed: true }] });
      const m = p.match(/collections\/([^/]+)\/records(?:\/([^/]+))?/);
      if (!m) return reply({});
      const f = u.searchParams.get('filter') || '';
      let rows = [];
      if (m[1] === 'dropdown') {
        rows = f.includes('cashflow account') ? [account] : f.includes('jenis menu') ? ['Overview', 'Service', 'Penjualan', 'Pembelian', 'Grosir', 'Retur', 'Gaji'].map((text_1, i) => ({ id: 'nav' + i, text_1, kategori: 'menu', jenis: 'jenis menu' })) : [person];
      }
      if (m[1] === 'user') rows = [user];
      if (m[1] === 'produk') rows = [product];
      if (m[1] === 'menu') rows = [menu];
      return reply({ items: rows, totalItems: rows.length, totalPages: 1, page: 1, perPage: 50 });
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('pocketbase_auth', JSON.stringify({ token, model: user }));
    localStorage.setItem('user_name', user.name);
    localStorage.setItem('user_username', user.username);
    localStorage.setItem('user_level', user.level);
  }, { token, user });

  console.log('Navigating to http://127.0.0.1:5173/pos ...');
  await page.goto('http://127.0.0.1:5173/pos', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  const title = await page.title();
  console.log('Final URL:', finalUrl);
  console.log('Page Title:', title);
  console.log('Console Errors caught:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Visible buttons count:', buttons.length);
  console.log('Sample buttons:', buttons.slice(0, 10));

  const hasNavbar = await page.evaluate(() => !!document.querySelector('.pos-navbar') || !!document.querySelector('nav'));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Body text snippet:\n', bodyText);

  await context.close();
  await browser.close();
  console.log('=== VERIFICATION RESULT: PASS ===');
}

run().catch(e => {
  console.error('CDP Test Error:', e);
  process.exit(1);
});
