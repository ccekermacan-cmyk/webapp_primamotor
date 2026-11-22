// Run with Playwright available in NODE_PATH. Every API request is intercepted.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5178';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local dev origin required');
const out = __dirname;
const product = {id:'product00000001',id_lama:'oil1',kategori:'Oli',merk:'MPX',keterangan:'Oli mesin',tipe:'Matic',jenis:'Motor',varian:'0.8L',unit:'pcs',beli:40000,sell_1:45000,sell_2:47000,sell_3:49000,sell_4:50000,sell_5:52000,sell_6:55000,min_1:12,min_2:6,min_3:3,stok_3:50};
const account={id:'account00000001',id_lama:'kas',text_1:'Kas kasir',jenis:'cashflow account'};
const person={id:'person000000001',id_lama:'umum1',text_1:'Umum1',kategori:'person',jenis:'customer'};
const menu={id:'nota00000000001',collectionName:'menu',jenis:'Service',person:'umum1',total:85000,dibayar:85000,status:'lunas',text:'Honda Beat',created_at:'2026-11-02 09:30:00',payment:'cash',operator:'Audit',file:['evidence.png']};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');
const observations={errors:[],blockedWrites:[],screens:[],checks:{}};
(async()=>{
 const browser=await chromium.launch();
 try {
 async function contextFor(level='1', draft=true) {
  const user={id:'user00000000001',collectionId:'users',collectionName:'user',username:'audit',name:'Audit User',level,status:'Active'};
  const mechanic={...user,id:'mechanic0000001',username:'andi',name:'Andi',level:'10',number:100000};
  const token='e30.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,id:user.id,collectionId:'users'})).toString('base64url')+'.fixture';
  const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(), u=new URL(req.url()), p=u.pathname;
   const reply=json=>route.fulfill({json});
   if(p.startsWith('/api/')){
    if(p.startsWith('/api/files/'))return route.fulfill({contentType:'image/png',body:png});
    if(p.endsWith('/auth-refresh'))return reply({token,record:user});
    if(p.includes('/permissions/delete'))return reply({results:[{collection:'menu',id:menu.id,allowed:true}]});
    if(req.method()!=='GET'){observations.blockedWrites.push(p);return route.fulfill({status:409,json:{message:'Audit forbids business mutations'}});}
    const m=p.match(/collections\/([^/]+)\/records(?:\/([^/]+))?/); if(!m)return reply({});
    const f=u.searchParams.get('filter')||'';let rows=[];
    if(m[1]==='dropdown')rows=f.includes('cashflow account')?[account]:f.includes('jenis menu')?['Overview','Service','Penjualan','Pembelian','Grosir','Retur','Gaji'].map((text_1,i)=>({id:'nav'+i,text_1,kategori:'menu',jenis:'jenis menu'})):[person];
    if(m[1]==='user')rows=[user,mechanic];
    if(m[1]==='produk')rows=[product];
    if(m[1]==='menu')rows=[menu];
    if(m[1]==='log_stock')rows=[{id:'stock0000000001',item_baru:product.id,item:product.id_lama,qty:1,price_1:55000,price_2:40000,boolean:'out',expand:{item_baru:product}}];
    if(m[1]==='ongkos')rows=[{id:'ongkos000000001',person:'andi',ongkos:30000}];
    if(m[1]==='cashflow')rows=[{id:'cashflow0000001',account_1:account.id,nominal:85000,mutasi:'in',note:'Audit'}];
    return reply(m[2]?(rows.find(r=>r.id===m[2])||rows[0]||{}):{page:1,perPage:100,totalItems:rows.length,totalPages:1,items:rows});
   }
   if(u.origin===base)return route.continue();
   return route.abort();
  });
  await ctx.addInitScript(({user,token,product,draft})=>{
   localStorage.setItem('pocketbase_auth',JSON.stringify({token,record:user,model:user}));
   localStorage.setItem('user_level',String(user.level));localStorage.setItem('user_name',user.name);
   if(draft)localStorage.setItem('pos_draft_cart',JSON.stringify({savedAt:Date.now(),selectedMenu:'Service',cart:[{...product,qty:1,priceSelected:55000}],formBayar:{personIdLama:'umum1',payment:'Tunai',nominalBayar:0,mekanikList:[{idLama:'andi',ongkos:30000}],cashflowList:[{accountId:'account00000001',nominal:85000}],noteMenu:'Honda Beat',note:'Audit',createdAt:'2026-11-02T09:30'}}));
  },{user,token,product,draft});
  return ctx;
 }
 const ctx=await contextFor();const page=await ctx.newPage();page.on('pageerror',e=>observations.errors.push(e.message));
 async function shot(name){await page.screenshot({path:path.join(out,name+'.png')});observations.screens.push(name+'.png');}
 await page.goto(base);await page.getByRole('button',{name:'Buka keranjang',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Transaksi Service',exact:true});await form.waitFor();await shot('form-desktop');
 observations.checks.formDialogs=await page.getByRole('dialog').count();
 observations.checks.unlabelledInputs=await form.locator('input,select,textarea').evaluateAll(els=>els.filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length).map(e=>({type:e.type,placeholder:e.placeholder||''})));
 await page.setViewportSize({width:390,height:844});await shot('form-mobile');
 observations.checks.mobileOverflow=await form.evaluate(e=>e.scrollWidth>e.clientWidth);
 await form.getByRole('button',{name:'Pembayaran',exact:true}).click();await shot('payment-mobile');
 await form.getByRole('button',{name:'Catatan',exact:true}).click();await shot('notes-mobile');
 await page.keyboard.press('Escape');observations.checks.escapeClosedCart=await form.count()===0;
 await ctx.close();
 const detailCtx=await contextFor('1',false);const p=await detailCtx.newPage();p.on('pageerror',e=>observations.errors.push(e.message));
 await p.goto(base+'/?ref='+menu.id);const detail=p.getByRole('dialog',{name:'Detail transaksi',exact:true});await detail.waitFor();
 await p.screenshot({path:path.join(out,'detail-desktop.png')});
 const edit=detail.getByRole('button',{name:/edit|ubah/i});await edit.click();
 const confirm=p.getByRole('dialog',{name:/Edit Transaksi Ini/i});await confirm.getByRole('button',{name:/lanjut|ya/i}).click();
 const editForm=p.getByRole('dialog',{name:'Edit Service',exact:true});await editForm.waitFor();
 await editForm.getByRole('button',{name:'Catatan',exact:true}).click();
 await p.screenshot({path:path.join(out,'edit-attachments.png')});
 observations.checks.editAttachmentText=await editForm.innerText();
 observations.checks.persistedEditDraft=await p.evaluate(()=>JSON.parse(localStorage.getItem('pos_draft_cart')||'null'));
 await p.evaluate(()=>history.replaceState(null,'','/'));await p.reload();await p.getByRole('button',{name:'Buka keranjang',exact:true}).click();
 observations.checks.afterReloadText=await p.getByRole('dialog',{name:'Transaksi Service',exact:true}).innerText();
 await detailCtx.close();
 const low=await contextFor('10',false), q=await low.newPage();await q.goto(base);await q.waitForTimeout(1000);
 observations.checks.level10Navigation=await q.getByRole('button').allTextContents();await q.screenshot({path:path.join(out,'level10.png')});await low.close();
 } finally {fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(observations,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
