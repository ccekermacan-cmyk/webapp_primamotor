// All writes use the supplied transactional app. Never call the global $app here.
const rows = (app, table, filter = '', params = {}, sort = '') => app.findRecordsByFilter(table, filter || 'id != ""', sort, 0, 0, params);
const find = (app, table, id) => { if (!id) return null; try { return app.findRecordById(table, id); } catch (error) { if (String(error).includes('no rows')) return null; throw error; } };
const value = (r, field) => r ? r.get(field) : null;
const text = (r, field) => r ? r.getString(field) : '';
const number = (r, field) => r ? r.getFloat(field) : 0;
const parent = r => text(r, 'ref_baru') || text(r, 'ref');
const lower = (r, field) => text(r, field).toLowerCase();
const json = r => JSON.stringify(r ? r.publicExport() : {});
const sql = (app, query, params = {}) => app.db().newQuery(query).bind(params).execute();
const fail = message => { throw new BadRequestError(message); };
const snapshot = data => ({get: k => data[k], getString: k => Array.isArray(data[k]) ? (data[k][0] || '') : String(data[k] ?? ''), getFloat: k => Number(data[k] || 0)});
exports.ready = app => app.hasTable('_pm_atomic_changes');

function wallet(app, id) {
  return find(app, 'dropdown', id) || (id ? rows(app, 'dropdown', 'id_lama = {:id}', {id})[0] : null);
}
function cashDeltas(app, record, legacy) {
  const result = {};
  if (!record) return result;
  const amount = number(record, 'nominal'), out = ['out','keluar'].includes(lower(record,'mutasi'));
  const source = wallet(app, text(record,'account_1') || text(record,'acc1'));
  const target = wallet(app, text(record,'account_2') || text(record,'acc2'));
  if (source) result[source.id] = out ? -amount : amount;
  if (out && target && (legacy || lower(record,'jenis').includes('transfer'))) result[target.id] = (result[target.id] || 0) + amount;
  return result;
}
function increment(app, table, id, field, delta) {
  if (!id || !delta) return;
  const record = find(app, table, id);
  if (!record) fail(`Referensi ${table} tidak ditemukan; transaksi dibatalkan.`);
  const next = number(record,field) + delta;
  if (!Number.isFinite(next)) fail('Nilai saldo atau stok tidak valid.');
  sql(app, `UPDATE "${table}" SET "${field}" = {:next} WHERE id = {:id}`, {next,id});
}
function loanTargets(app, r) {
  const person = text(r,'person');
  let user = text(r,'user');
  if (!user && person) {
    const dp = find(app,'dropdown',person);
    const name = lower(dp,'text_1').trim();
    if (name) user = (rows(app,'user').filter(r => lower(r,'name').trim() === name || lower(r,'username').trim() === name)[0] || {}).id || '';
  }
  return {person,user};
}
function loanEffect(app, r, sign) {
  if (!r) return;
  const delta = (lower(r,'jenis') === 'out' ? 1 : -1) * Math.abs(number(r,'nominal')) * sign;
  const target = loanTargets(app,r);
  increment(app,'dropdown',target.person,'number_1',delta);
  increment(app,'user',target.user,'number',delta);
}
function journal(app, token, collection, event, old, current, id) {
  sql(app, 'INSERT INTO _pm_atomic_changes(id,batch_id,collection_name,record_id,event,old_data,new_data) VALUES ({:key},{:token},{:collection},{:id},{:event},{:old},{:current})',
    {key:$security.randomString(24),token,collection,id,event,old:json(old),current:json(current)});
}
// Derived records bypass model hooks and explicitly run the same effect implementation.
function derived(app, token, collection, old, data) {
  const id = old ? old.id : '';
  if (data === null) {
    if (!old) return;
    cascade(app, token, collection, old);
    old.set('_pm_internal',true); app.delete(old);
    effects(app,token,collection,old,null);
    journal(app,token,collection,'deleted',old,null,id);
    return;
  }
  const r = old ? app.findRecordById(collection,id) : new Record(app.findCollectionByNameOrId(collection));
  for (const key of Object.keys(data)) r.set(key,data[key]);
  prepare(app,collection,r);
  r.set('_pm_internal',true); app.save(r);
  effects(app,token,collection,old,r);
  journal(app,token,collection,old ? 'updated' : 'created',old,r,r.id);
}
function cascade(app, token, collection, r) {
  if (collection === 'menu') {
    for (const child of ['log_stock','ongkos','cashflow']) {
      for (const item of rows(app,child,'ref_baru = {:id} || ref = {:id}',{id:r.id})) derived(app,token,child,item,null);
    }
    const salaries = rows(app,'gaji','ref_baru = {:id} || ref = {:id}',{id:r.id});
    const salaryIds = salaries.map(item => item.id);
    for (const bon of rows(app,'bon')) {
      if (text(bon,'ref_menu') === r.id || salaryIds.includes(text(bon,'ref_gaji'))) derived(app,token,'bon',bon,null);
    }
    for (const salary of salaries) app.delete(salary);
  }
  if (collection === 'cashflow') for (const bon of rows(app,'bon','ref_cashflow = {:id}',{id:r.id})) derived(app,token,'bon',bon,null);
}
function effects(app, token, collection, old, current) {
  if (collection === 'cashflow') {
    const deltas = cashDeltas(app,current,false);
    for (const [id,amount] of Object.entries(cashDeltas(app,old,false))) deltas[id] = (deltas[id] || 0) - amount;
    for (const [id,delta] of Object.entries(deltas)) increment(app,'dropdown',id,'number_1',delta);
    if (current) {
      const linked = rows(app,'bon','ref_cashflow = {:id}',{id:current.id});
      const kind = lower(current,'jenis'), out = lower(current,'mutasi') === 'out';
      for (const bon of linked) {
        derived(app,token,'bon',bon, out && ['bon','bonkaryawan'].includes(kind) ? {
          nominal:number(current,'nominal'), created_at:text(current,'created_at'), akun_asal:text(current,'account_1'),
          note:text(current,'note'), operator:text(current,'operator'),
          ...(kind === 'bonkaryawan' ? {user:text(current,'account_2'),person:text(current,'person'),persontext:text(current,'persontext')} : {})
        } : null);
      }
      if (!linked.length && kind === 'bonkaryawan' && out && !parent(current)) {
        const user = find(app,'user',text(current,'account_2')) || rows(app,'user','username = {:name}',{name:text(current,'persontext')})[0];
        derived(app,token,'bon',null,{nominal:number(current,'nominal'),jenis:'out',ref_cashflow:current.id,
          created_at:text(current,'created_at'),akun_asal:text(current,'account_1'),person:text(current,'person'),
          user:user ? user.id : '',persontext:text(current,'persontext'),note:text(current,'note'),operator:text(current,'operator')});
      }
    }
  }
  if (collection === 'log_stock') {
    const deltas = {};
    for (const [r,sign] of [[old,-1],[current,1]]) if (r) {
      const id = text(r,'item_baru');
      if (!id || !find(app,'produk',id)) fail('Produk pada log stok tidak ditemukan.');
      deltas[id] = (deltas[id] || 0) + sign * (lower(r,'boolean') === 'in' ? number(r,'qty') : -number(r,'qty'));
    }
    for (const [id,delta] of Object.entries(deltas)) increment(app,'produk',id,'stok_3',delta);
  }
  if (collection === 'bon') { loanEffect(app,old,-1); loanEffect(app,current,1); }
}
function prepare(app, collection, r) {
  if (collection === 'bon') {
    if (!Number.isFinite(number(r,'nominal')) || number(r,'nominal') <= 0 || !['in','out'].includes(lower(r,'jenis'))) fail('Nominal dan arah bon tidak valid.');
    let target = loanTargets(app,r);
    if (!target.user && text(r,'persontext')) target.user = (rows(app,'user','username = {:name}',{name:text(r,'persontext')})[0] || {}).id || '';
    if (target.user) r.set('user',target.user);
    if (!target.user && !target.person) fail('Penerima bon tidak ditemukan.');
  }
  if (collection === 'ongkos' && (!Number.isFinite(number(r,'ongkos')) || number(r,'ongkos') < 0)) fail('Ongkos tidak valid.');
}
exports.authorize = (e, deleting) => {
  const name = e.record.collection().name;
  if (name === 'bon' && text(e.record,'ref_cashflow') && deleting) fail('Hapus bon melalui transaksi cashflow terkait agar saldo kas ikut dikembalikan.');
  if (!e.auth || e.auth.collection().name !== 'user' || e.auth.getInt('level') === 1) return;
  const cash = name === 'cashflow' ? [e.record] : name === 'menu' && deleting
    ? rows(e.app,'cashflow','ref_baru = {:id} || ref = {:id}',{id:e.record.id}) : [];
  for (const record of cash) for (const id of Object.keys(cashDeltas(e.app,record,false))) {
    const account = wallet(e.app,id);
    const contains = (raw,token) => raw.split(',').map(part => part.trim()).includes(token);
    if (!account || !contains(text(account,'visibilitas'),String(e.auth.getInt('level'))) || !contains(text(account,'enum_1'),e.auth.getString('username'))) throw new ForbiddenError('Anda tidak memiliki akses ke akun ini.');
  }
};
exports.mutation = (e, event) => {
  if (!exports.ready(e.app) || e.record.getBool('_pm_internal')) { e.next(); return; }
  const collection = e.record.collection().name;
  const batch = e.record.getString('_pm_batch');
  const token = batch || $security.randomString(24);
  e.app.runInTransaction(app => {
    e.app = app;
    // Read the actual pre-write row under the write transaction, never a browser snapshot.
    const old = event === 'created' ? null : app.findRecordById(collection,e.record.id);
    let expected = JSON.parse(e.record.getString('_pm_expected') || 'null');
    if (typeof expected === 'string') expected = JSON.parse(expected);
    if (old && expected) {
      const fields = collection === 'menu' ? ['jenis','total','dibayar','status','qty','created_at','person_baru']
        : collection === 'cashflow' ? ['nominal','mutasi','jenis','account_1','account_2','ref_baru','created_at'] : [];
      for (const field of fields) if (Object.prototype.hasOwnProperty.call(expected,field) && String(expected[field] ?? '') !== String(value(old,field) ?? '')) {
        fail('Data transaksi berubah sejak form dibuka. Muat ulang sebelum menyimpan.');
      }
    }
    const expectedStock = JSON.parse(e.record.getString('_pm_expected_stock') || 'null');
    if (collection === 'log_stock' && expectedStock !== null && Number(expectedStock) !== number(find(app,'produk',text(e.record,'item_baru')),'stok_3')) {
      fail('Stok berubah sejak form dibuka. Muat ulang sebelum melakukan koreksi.');
    }
    if (event === 'deleted') cascade(app,token,collection,old);
    else prepare(app,collection,e.record);
    e.next();
    const current = event === 'deleted' ? null : e.record;
    effects(app,token,collection,old,current);
    journal(app,token,collection,event,old,current,e.record.id);
    if (!batch) exports.finish(app,token);
  });
};
function changes(app, token) {
  const result = arrayOf(new DynamicModel({collection_name:'',record_id:'',old_data:'',new_data:''}));
  app.db().newQuery('SELECT collection_name,record_id,old_data,new_data FROM _pm_atomic_changes WHERE batch_id = {:token}').bind({token}).all(result);
  return result;
}
function localDate(raw) {
  if (!raw) return '';
  const time = Date.parse(String(raw).replace(' ','T') + (/Z$|[+-]\d\d:\d\d$/.test(raw) ? '' : 'Z'));
  return Number.isFinite(time) ? new Date(time + 7*3600000).toISOString().slice(0,10) : '';
}
function syncMenu(app, id) {
  const menu = find(app,'menu',id);
  if (!menu) return;
  if (!/penjualan|servis|service|pembelian|minuman/.test(lower(menu,'jenis'))) return;
  const paid = rows(app,'cashflow','ref_baru = {:id} || ref = {:id}',{id}).reduce((sum,r) => sum + number(r,'nominal'),0);
  const proof = !lower(menu,'jenis').includes('pembelian') || (value(menu,'file') || []).length > 0;
  const settled = paid >= number(menu,'total') && number(menu,'total') > 0 && proof;
  sql(app,'UPDATE menu SET dibayar = {:paid}, status = {:status}, date_lunas = {:date} WHERE id = {:id}',
    {id,paid,status:settled ? 'lunas' : 'belum',date:settled ? (text(menu,'date_lunas') || new Date().toISOString().replace('T',' ')) : ''});
}
function rebuildAccount(app, id) {
  const account = find(app,'dropdown',id);
  if (!account) fail('Akun tidak ditemukan.');
  const balance = number(account,'number_1');
  if (balance < -0.00001) fail('Saldo akun tidak cukup untuk perubahan ini. Seluruh batch dibatalkan.');
  const source = "(account_1 = {:id} OR (COALESCE(account_1,'') = '' AND acc1 != '' AND (acc1 = {:id} OR acc1 = {:code})))";
  const target = "(account_2 = {:id} OR (COALESCE(account_2,'') = '' AND acc2 != '' AND (acc2 = {:id} OR acc2 = {:code})))";
  sql(app, `WITH movement AS (
    SELECT id, created_at, ${source} AS source,
      (CASE WHEN ${source} THEN CASE WHEN LOWER(mutasi) IN ('out','keluar') THEN -nominal ELSE nominal END ELSE 0 END)
      + (CASE WHEN ${target} AND LOWER(mutasi) IN ('out','keluar') AND LOWER(jenis) LIKE '%transfer%' THEN nominal ELSE 0 END) AS delta
    FROM cashflow WHERE ${source} OR ${target}
  ), ledger AS (
    SELECT id,source,delta,SUM(delta) OVER () AS total,
      SUM(delta) OVER (ORDER BY datetime(created_at),id ROWS UNBOUNDED PRECEDING) AS running FROM movement
  ) UPDATE cashflow SET
    saldo_awal = {:balance} - (SELECT total-running+delta FROM ledger WHERE ledger.id=cashflow.id),
    saldo_akhir = {:balance} - (SELECT total-running FROM ledger WHERE ledger.id=cashflow.id)
    WHERE id IN (SELECT id FROM ledger WHERE source)`, {id,code:text(account,'id_lama'),balance});
}
function rebuildStock(app, id, priceChanged) {
  const product = find(app,'produk',id);
  if (!product) fail('Produk tidak ditemukan.');
  const balance = number(product,'stok_3');
  if (balance < 0) fail('Stok produk tidak cukup untuk perubahan ini. Seluruh batch dibatalkan.');
  sql(app, `WITH movement AS (
    SELECT id,created_at,CASE WHEN LOWER(boolean)='in' THEN qty ELSE -qty END AS delta FROM log_stock WHERE item_baru={:id}
  ), ledger AS (
    SELECT id,delta,SUM(delta) OVER () AS total,
      SUM(delta) OVER (ORDER BY datetime(created_at),id ROWS UNBOUNDED PRECEDING) AS running FROM movement
  ) UPDATE log_stock SET
    stok_awal={:balance}-(SELECT total-running+delta FROM ledger WHERE ledger.id=log_stock.id),
    stok_akhir={:balance}-(SELECT total-running FROM ledger WHERE ledger.id=log_stock.id)
    WHERE id IN (SELECT id FROM ledger)`, {id,balance});
  if (priceChanged) sql(app, `UPDATE produk SET beli=COALESCE((SELECT price_1 FROM log_stock
    WHERE item_baru={:id} AND boolean='in' AND price_1>0 ORDER BY datetime(created_at) DESC,id DESC LIMIT 1),0) WHERE id={:id}`,{id});
}
function report(app, date) {
  const totals = {omset_toko:0,omset_servis:0,omset_minuman:0,laba_penjualan:0,laba_service:0,laba_minuman:0,operasional_toko:0,pengeluaran_lain:0,pemasukan_lain:0,hutang:0,piutang:0,kasir_toko:0};
  const start = new Date(date+'T00:00:00+07:00');
  const params = {start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString()};
  const aggregate = (query, fields) => {
    // Seed with a non-integral float: goja maps integral JS numbers to int64, but report sums are REAL.
    const result = new DynamicModel(Object.fromEntries(fields.map(field => [field,0.5])));
    app.db().newQuery(query).bind(params).one(result);
    for (const field of fields) totals[field] = Number(result[field] || 0);
  };
  const menuDate = 'datetime(m.created_at)>=datetime({:start}) AND datetime(m.created_at)<datetime({:end})';
  const revenue = 'l.price_1*l.qty', profit = '('+revenue+'-l.price_2)';
  const drink = "(LOWER(COALESCE(p.kategori,''))='minuman' OR LOWER(m.jenis) LIKE '%minuman%')";
  const service = "(LOWER(m.jenis) LIKE '%servis%' OR LOWER(m.jenis) LIKE '%service%')";
  aggregate(`SELECT
    COALESCE(SUM(CASE WHEN LOWER(m.jenis) LIKE '%pembelian%' THEN MAX(0,m.total-m.dibayar) ELSE 0 END),0) AS hutang,
    COALESCE(SUM(CASE WHEN LOWER(m.jenis) LIKE '%penjualan%' OR ${service} THEN MAX(0,m.total-m.dibayar) ELSE 0 END),0) AS piutang
    FROM menu m WHERE ${menuDate} AND LOWER(m.status)='belum'`,['hutang','piutang']);
  aggregate(`SELECT
    COALESCE(SUM(CASE WHEN NOT ${drink} THEN ${revenue} ELSE 0 END),0) AS omset_toko,
    COALESCE(SUM(CASE WHEN ${drink} THEN ${revenue} ELSE 0 END),0) AS omset_minuman,
    COALESCE(SUM(CASE WHEN NOT ${drink} AND NOT ${service} THEN ${profit} ELSE 0 END),0) AS laba_penjualan,
    COALESCE(SUM(CASE WHEN NOT ${drink} AND ${service} THEN ${profit} ELSE 0 END),0) AS laba_service,
    COALESCE(SUM(CASE WHEN ${drink} THEN ${profit} ELSE 0 END),0) AS laba_minuman
    FROM log_stock l JOIN menu m ON m.id=COALESCE(NULLIF(l.ref_baru,''),l.ref)
    LEFT JOIN produk p ON p.id=l.item_baru WHERE ${menuDate} AND LOWER(l.boolean)='out'
    AND LOWER(m.jenis) NOT LIKE '%pembelian%' AND LOWER(m.jenis) NOT LIKE '%rusak%' AND LOWER(m.jenis) NOT LIKE '%opname%'`,
    ['omset_toko','omset_minuman','laba_penjualan','laba_service','laba_minuman']);
  const belongs = field => `((${menuDate}) OR (COALESCE(NULLIF(c.ref_baru,''),c.ref,'')='' AND datetime(c.${field})>=datetime({:start}) AND datetime(c.${field})<datetime({:end})))`;
  aggregate(`SELECT COALESCE(SUM(c.ongkos),0) AS omset_servis FROM ongkos c LEFT JOIN menu m ON m.id=COALESCE(NULLIF(c.ref_baru,''),c.ref) WHERE ${belongs('date')}`,['omset_servis']);
  aggregate(`SELECT
    COALESCE(SUM(CASE WHEN LOWER(c.mutasi) IN ('out','keluar') AND LOWER(c.jenis) NOT LIKE '%pembelian%' AND LOWER(c.jenis) NOT LIKE '%transfer%' AND LOWER(c.jenis) LIKE '%operasional%' THEN c.nominal ELSE 0 END),0) AS operasional_toko,
    COALESCE(SUM(CASE WHEN LOWER(c.mutasi) IN ('out','keluar') AND LOWER(c.jenis) NOT LIKE '%pembelian%' AND LOWER(c.jenis) NOT LIKE '%transfer%' AND LOWER(c.jenis) NOT LIKE '%operasional%' THEN c.nominal ELSE 0 END),0) AS pengeluaran_lain,
    COALESCE(SUM(CASE WHEN LOWER(c.mutasi) IN ('in','masuk') AND LOWER(c.jenis) LIKE '%pemasukan%' THEN c.nominal ELSE 0 END),0) AS pemasukan_lain
    FROM cashflow c LEFT JOIN menu m ON m.id=COALESCE(NULLIF(c.ref_baru,''),c.ref) WHERE ${belongs('created_at')}`,
    ['operasional_toko','pengeluaran_lain','pemasukan_lain']);
  totals.kasir_toko = totals.omset_toko+totals.omset_servis+totals.omset_minuman+totals.pemasukan_lain-totals.operasional_toko-totals.pengeluaran_lain;
  let r = rows(app,'report','created_at >= {:start} && created_at < {:end}',{start:date+' 00:00:00.000Z',end:date+' 23:59:59.999Z'})[0];
  if (!r) r = new Record(app.findCollectionByNameOrId('report'),{created_at:date+' 00:00:00.000Z'});
  for (const [key,val] of Object.entries(totals)) r.set(key,val);
  app.save(r);
}
exports.personBalance = (app, person) => {
  const kind = lower(person,'jenis');
  const supplier = kind.includes('supplier');
  if (!supplier && !kind.includes('customer')) fail('Hitung ulang hanya tersedia untuk pelanggan atau supplier.');
  // goja exports integral JS numbers as int64; balance is a REAL sum, so seed with a non-integral float.
  const result = new DynamicModel({balance:0.5});
  const category = supplier ? "LOWER(jenis) LIKE '%pembelian%'" : "(LOWER(jenis) LIKE '%penjualan%' OR LOWER(jenis) LIKE '%service%' OR LOWER(jenis) LIKE '%servis%')";
  app.db().newQuery(`SELECT COALESCE(SUM(MAX(0,total-dibayar)),0) AS balance FROM menu
    WHERE (person_baru={:id} OR (COALESCE(person_baru,'')='' AND person!='' AND (person={:id} OR person={:code}))) AND ${category}`)
    .bind({id:person.id,code:text(person,'id_lama')}).one(result);
  return Number(result.balance || 0);
};
exports.finish = (app, token) => {
  const accounts = new Set(), products = new Set(), prices = new Set(), menus = new Set(), dates = new Set(), people = new Set();
  for (const change of changes(app,token)) {
    for (const raw of [change.old_data,change.new_data]) {
      const data = JSON.parse(raw), r = snapshot(data);
      if (change.collection_name === 'cashflow') for (const id of Object.keys(cashDeltas(app,r,false))) accounts.add(id);
      if (change.collection_name === 'log_stock' && text(r,'item_baru')) {
        products.add(text(r,'item_baru'));
        if (lower(r,'boolean') === 'in' && number(r,'price_1') > 0) prices.add(text(r,'item_baru'));
      }
      if (change.collection_name === 'menu') {
        menus.add(change.record_id);
        const person = wallet(app,text(r,'person_baru') || text(r,'person'));
        if (person) people.add(person.id);
      }
      if (parent(r)) menus.add(parent(r));
      const date = localDate(text(r,'created_at') || text(r,'date'));
      if (date) dates.add(date);
    }
  }
  for (const id of menus) {
    syncMenu(app,id);
    const menu = find(app,'menu',id);
    const person = wallet(app,text(menu,'person_baru') || text(menu,'person'));
    if (person) people.add(person.id);
    const date = localDate(text(menu,'created_at'));
    if (date) dates.add(date);
  }
  for (const id of people) {
    const person = find(app,'dropdown',id);
    if (/customer|supplier/.test(lower(person,'jenis'))) sql(app,'UPDATE dropdown SET number_1={:balance} WHERE id={:id}',{id,balance:exports.personBalance(app,person)});
  }
  for (const id of accounts) rebuildAccount(app,id);
  for (const id of products) rebuildStock(app,id,prices.has(id));
  for (const date of dates) report(app,date);
};
