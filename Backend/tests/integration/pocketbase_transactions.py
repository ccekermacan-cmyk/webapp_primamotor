"""Read collection schemas only; test against temporary PocketBase/Laravel servers and synthetic data.
Run from any directory: python3 Backend/tests/integration/pocketbase_transactions.py
Requires Backend/pocketbase and php8.3 with pdo_sqlite. No production records or files are copied.
"""
import base64, email, json, os, queue, re, shutil, socketserver, sqlite3, subprocess, tempfile, threading, time, urllib.request, urllib.error, urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[3]; tmp=Path(tempfile.mkdtemp(prefix='prima-integration-')); (tmp/'migrations').mkdir(); (tmp/'hooks').mkdir(); data=tmp/'data'
source=sqlite3.connect(f'file:{root}/Backend/pb_data/data.db?mode=ro',uri=True);source.row_factory=sqlite3.Row
def strip_secrets(value):
 if isinstance(value,dict):return {k:strip_secrets(v) for k,v in value.items() if not k.lower().endswith('secret')}
 if isinstance(value,list):return [strip_secrets(v) for v in value]
 return value
collections=[]
for row in source.execute("SELECT * FROM _collections WHERE name NOT LIKE '\\_%' ESCAPE '\\'"):
 d=dict(row); options=strip_secrets(json.loads(d.pop('options'))); d.update(options)
 for k in ['fields','indexes']: d[k]=json.loads(d[k])
 for k in ['created','updated']:d.pop(k,None)
 d['system']=bool(d['system']);collections.append(d)
source.close()
# Only schema definitions are copied. No users, transactions, files, or application secrets are copied.
for p in (root/'Backend/pb_hooks').glob('*.js'):
 (tmp/'hooks'/p.name).write_text(p.read_text().replace('http://pm-nginx','http://127.0.0.1:18080'))
shutil.copytree(root/'Backend/pb_hooks/lib',tmp/'hooks/lib')
pbflags=['--dev','--dir',str(data),'--migrationsDir',str(tmp/'migrations'),'--hooksDir',str(tmp/'hooks')]
subprocess.run([str(root/'Backend/pocketbase'),'superuser','create','integration@example.test','Local-Test-Only-Password-429!',*pbflags],check=True,stdout=subprocess.DEVNULL)
os.environ['PM_API_INTERNAL_URL']='http://127.0.0.1:18080/api'
processes=[];logs=[];passed=False;smtp_server=None
def api(base,path,method='GET',body=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=30) as res:return res.status,json.load(res) if res.status!=204 else None
 except urllib.error.HTTPError as e:raise RuntimeError(f'{method} {path}: {e.code} {e.read().decode()}')
def wait(base):
 for i in range(100):
  try:urllib.request.urlopen(base,timeout=1);return
  except urllib.error.HTTPError:return
  except OSError:time.sleep(.1)
 raise RuntimeError('server did not start')
try:
 f=open(tmp/'pb.log','w');logs.append(f);processes.append(subprocess.Popen([str(root/'Backend/pocketbase'),'serve','--http','127.0.0.1:18090',*pbflags],stdout=f,stderr=subprocess.STDOUT));wait('http://127.0.0.1:18090/api/health')
 pb='http://127.0.0.1:18090';_,auth=api(pb,'/api/collections/_superusers/auth-with-password','POST',{'identity':'integration@example.test','password':'Local-Test-Only-Password-429!'})
 admin=auth['token'];api(pb,'/api/collections/import','PUT',{'collections':collections,'deleteMissing':False},admin)
 # Apply the new additive migration to the isolated schema, then restart PocketBase.
 processes[0].terminate();processes[0].wait(timeout=5)
 import shutil
 shutil.copy(root/'Backend/pb_migrations/1792270800_add_transaction_relations.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792270900_require_authenticated_access.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792271000_protect_employee_history.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792271100_scope_salary_reads.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792271200_protect_product_stock.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792271300_atomic_ledger.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792271400_atomic_receipts.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792358000_open_operational_entry.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792358100_protect_derived_balance.js',tmp/'migrations')
 shutil.copy(root/'Backend/pb_migrations/1792358200_preserve_admin_balance_correction.js',tmp/'migrations')
 subprocess.run([str(root/'Backend/pocketbase'),'migrate','up',*pbflags],check=True,stdout=subprocess.DEVNULL)
 processes[0]=subprocess.Popen([str(root/'Backend/pocketbase'),'serve','--http','127.0.0.1:18090',*pbflags],stdout=f,stderr=subprocess.STDOUT);wait(pb+'/api/health')
 # Enable atomic batch requests in the isolated PocketBase instance.
 api(pb,'/api/settings','PATCH',{'batch':{'enabled':True,'maxRequests':100,'timeout':30,'maxBodySize':10485760}},admin)
 _,user=api(pb,'/api/collections/user/records','POST',{'email':'cashier@example.test','username':'integrationcashier','name':'Integration Cashier','status':'Active','level':1,'password':'Local-Cashier-Only-729!','passwordConfirm':'Local-Cashier-Only-729!'},admin)
 _,auth=api(pb,'/api/collections/user/auth-with-password','POST',{'identity':'integrationcashier','password':'Local-Cashier-Only-729!'})
 token=auth['token']
 def denied(path,method='GET',body=None,auth_token=None):
  try:
   api(pb,path,method,body,auth_token)
  except RuntimeError as error:
   assert any(f': {code} ' in str(error) for code in [400,401,403,404]), str(error)
   return
  raise AssertionError('Unexpected access granted: '+path)
 assert api(pb,'/api/collections/cashflow/records')[1]['items'] == []
 assert api(pb,'/api/collections/dropdown/records')[1]['items'] == []
 _,staff=api(pb,'/api/collections/user/records','POST',{'email':'staff@example.test','username':'integrationstaff','status':'Active','level':2,'password':'Local-Staff-Only-729!','passwordConfirm':'Local-Staff-Only-729!'},admin)
 _,staff_auth=api(pb,'/api/collections/user/auth-with-password','POST',{'identity':'integrationstaff','password':'Local-Staff-Only-729!'})
 denied('/api/collections/user/records/'+staff['id'],'PATCH',{'level':1},staff_auth['token'])
 print('PASS: anonymous data access and employee privilege escalation are denied')
 api(pb,'/api/collections/user/auth-refresh','POST',{},token)
 print('PASS: PocketBase accepts user token refresh')
 _,product=api(pb,'/api/collections/produk/records','POST',{'id_lama':'tprod','stok_3':0,'beli':100,'kategori':'Sparepart'},admin)
 _,wallet=api(pb,'/api/collections/dropdown/records','POST',{'text_1':'integrationwallet','jenis':'Cashflow Account','kategori':'Cashflow','number_1':1000},admin)
 assert api(pb,'/api/collections/dropdown/records')[1]['items'] == []
 denied('/api/collections/dropdown/records/'+wallet['id'])
 denied('/api/collections/dropdown/records/'+wallet['id'],'PATCH',{'number_1':99999},None)
 # Exact token permissions prevent staff from writing another account.
 denied('/api/collections/dropdown/records/'+wallet['id'],'PATCH',{'number_1':99999},staff_auth['token'])
 _,staffEntry=api(pb,'/api/collections/cashflow/records','POST',{'account_1':wallet['id'],'nominal':1,'mutasi':'out'},staff_auth['token'])
 api(pb,'/api/collections/cashflow/records/'+staffEntry['id'],'PATCH',{'nominal':2},staff_auth['token'])
 denied('/api/collections/cashflow/records/'+staffEntry['id'],'DELETE',auth_token=staff_auth['token'])
 api(pb,'/api/collections/cashflow/records/'+staffEntry['id'],'DELETE',token=admin)
 denied('/api/collections/cashflow/records','POST',{'account_1':wallet['id'],'nominal':1001,'mutasi':'out'},token)
 denied('/api/collections/cashflow/records','POST',{'account_1':wallet['id'],'account_2':wallet['id'],'jenis':'transfer','nominal':1,'mutasi':'out'},token)
 print('PASS: unauthorized balance writes, overdrafts and same-account transfers are rejected')
 _,menu=api(pb,'/api/collections/menu/records','POST',{'jenis':'penjualan','total':400,'dibayar':400,'status':'lunas','created_at':'2026-10-18 04:00:00.000Z'},admin)
 env=dict(os.environ,APP_ENV='testing',APP_KEY='base64:'+base64.b64encode(os.urandom(32)).decode(),DB_CONNECTION='sqlite',DB_DATABASE=str(data/'data.db'),DB_URL='',CACHE_STORE='array',SESSION_DRIVER='array',QUEUE_CONNECTION='sync',POCKETBASE_URL=pb,LOG_CHANNEL='stderr')
 f=open(tmp/'php.log','w');logs.append(f);processes.append(subprocess.Popen(['php8.3','-S','127.0.0.1:18080','-t',str(root/'Backend/public')],cwd=root/'Backend',env=env,stdout=f,stderr=subprocess.STDOUT));wait('http://127.0.0.1:18080/up')
 # Authentication outages are recoverable and do not require recreating persisted transactions.
 api('http://127.0.0.1:18080','/api/user',token=token)
 processes[0].terminate();processes[0].wait(timeout=5)
 try:
  api('http://127.0.0.1:18080','/api/user',token=token)
  raise AssertionError('Stopped PocketBase should report an authentication outage')
 except RuntimeError as error:assert ': 503 ' in str(error)
 processes[0]=subprocess.Popen([str(root/'Backend/pocketbase'),'serve','--http','127.0.0.1:18090',*pbflags],stdout=logs[0],stderr=subprocess.STDOUT)
 wait(pb+'/api/health')
 api('http://127.0.0.1:18080','/api/user',token=token)
 print('PASS: authentication outage returns 503 and valid-token requests recover after connectivity is restored')
 _,openingLog=api(pb,'/api/collections/log_stock/records','POST',{'item_baru':product['id'],'qty':10,'boolean':'in','price_1':0,'created_at':'2026-10-17 04:00:00.000Z'},admin)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'opening-stock','events':[{'collection':'log_stock','event':'created','id':openingLog['id']}]},token)
 requests=[{'method':'POST','url':'/api/collections/log_stock/records','body':{'item_baru':product['id'],'qty':2,'price_1':200,'price_2':200,'boolean':'out','ref_baru':menu['id'],'created_at':'2026-10-18 04:00:00.000Z'}},{'method':'POST','url':'/api/collections/cashflow/records','body':{'account_1':wallet['id'],'nominal':400,'mutasi':'in','jenis':'penjualan','ref_baru':menu['id'],'created_at':'2026-10-18 04:00:00.000Z'}}]
 _,results=api(pb,'/api/batch','POST',{'requests':requests},admin)
 payload={'request_id':'integration-create-1','events':[{'collection':'menu','event':'created','id':menu['id']},{'collection':'log_stock','event':'created','id':results[0]['body']['id']},{'collection':'cashflow','event':'created','id':results[1]['body']['id']}]}
 for _ in range(2):api(pb,'/api/webhooks/batch','POST',payload,token)
 _,prod=api(pb,'/api/collections/produk/records/'+product['id'],token=admin);_,acc=api(pb,'/api/collections/dropdown/records/'+wallet['id'],token=admin)
 assert prod['stok_3']==8,prod['stok_3'];assert acc['number_1']==1400,acc['number_1']
 # Edit a persisted record with its complete PocketBase snapshot (including file metadata).
 _,oldLog=api(pb,'/api/collections/log_stock/records/'+results[0]['body']['id'],token=admin)
 _,oldCf=api(pb,'/api/collections/cashflow/records/'+results[1]['body']['id'],token=admin)
 api(pb,'/api/collections/log_stock/records/'+oldLog['id'],'PATCH',{'qty':3},admin)
 api(pb,'/api/collections/cashflow/records/'+oldCf['id'],'PATCH',{'nominal':600},admin)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'integration-edit-1','events':[
  {'collection':'log_stock','event':'updated','id':oldLog['id'],'old_data':oldLog},
  {'collection':'cashflow','event':'updated','id':oldCf['id'],'old_data':oldCf}]},token)
 _,prod=api(pb,'/api/collections/produk/records/'+product['id'],token=admin);_,acc=api(pb,'/api/collections/dropdown/records/'+wallet['id'],token=admin)
 assert prod['stok_3']==7;assert acc['number_1']==1600
 api(pb,'/api/transactions/menu/'+menu['id'],'DELETE',token=token)
 _,prod=api(pb,'/api/collections/produk/records/'+product['id'],token=admin);_,acc=api(pb,'/api/collections/dropdown/records/'+wallet['id'],token=admin)
 assert prod['stok_3']==10,prod['stok_3'];assert acc['number_1']==1000,acc['number_1']
 # Verify employee loan effects and salary references against the actual collection schema.
 _,salaryMenu=api(pb,'/api/collections/menu/records','POST',{'jenis':'gaji','total':50,'status':'lunas','created_at':'2026-10-18 04:00:00.000Z'},admin)
 salaryId='salaryfixture01'
 _,salaryBatch=api(pb,'/api/batch','POST',{'requests':[
  {'method':'POST','url':'/api/collections/gaji/records','body':{'id':salaryId,'person':'integrationcashier','ref_baru':salaryMenu['id'],'ref':salaryMenu['id']}},
  {'method':'POST','url':'/api/collections/bon/records','body':{'user':user['id'],'ref_menu':salaryMenu['id'],'ref_gaji':salaryId,'nominal':50,'jenis':'out','created_at':'2026-10-18 04:00:00.000Z'}}]},admin)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'salary-create-1','events':[{'collection':'menu','event':'created','id':salaryMenu['id']},{'collection':'bon','event':'created','id':salaryBatch[1]['body']['id']}]},token)
 _,employee=api(pb,'/api/collections/user/records/'+user['id'],token=admin);assert employee['number']==50
 api(pb,'/api/transactions/menu/'+salaryMenu['id'],'DELETE',token=token)
 _,employee=api(pb,'/api/collections/user/records/'+user['id'],token=admin);assert employee['number']==0
 # A manual employee loan links to cashflow without requiring a dropdown person record.
 cashflowId='manualcashflow1'
 _,manual=api(pb,'/api/batch','POST',{'requests':[
  {'method':'POST','url':'/api/collections/cashflow/records','body':{'id':cashflowId,'account_1':wallet['id'],'jenis':'bon','mutasi':'out','nominal':100,'created_at':'2026-10-18 04:00:00.000Z'}},
  {'method':'POST','url':'/api/collections/bon/records','body':{'user':user['id'],'ref_cashflow':cashflowId,'jenis':'out','nominal':100,'created_at':'2026-10-18 04:00:00.000Z'}}]},token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'manual-bon-create','events':[{'collection':'cashflow','event':'created','id':cashflowId},{'collection':'bon','event':'created','id':manual[1]['body']['id']}]},token)
 _,old=api(pb,'/api/collections/cashflow/records/'+cashflowId,token=token)
 api(pb,'/api/collections/cashflow/records/'+cashflowId,'PATCH',{'nominal':150},token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'manual-bon-edit','events':[{'collection':'cashflow','event':'updated','id':cashflowId,'old_data':old}]},token)
 _,employee=api(pb,'/api/collections/user/records/'+user['id'],token=admin);assert employee['number']==150
 # Verify the actual PocketBase file removal modifier with a synthetic one-pixel PNG.
 boundary='PrimaIntegrationFileBoundary'
 image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=')
 multipart=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image+f'\r\n--{boundary}--\r\n'.encode())
 req=urllib.request.Request(pb+'/api/collections/cashflow/records/'+cashflowId,data=multipart,method='PATCH',headers={'Content-Type':'multipart/form-data; boundary='+boundary,'Authorization':'Bearer '+token})
 with urllib.request.urlopen(req) as response: uploaded=json.load(response)
 assert len(uploaded['file'])==1
 _,removed=api(pb,'/api/collections/cashflow/records/'+cashflowId,'PATCH',{'file-':uploaded['file']},token)
 assert removed['file']==[]
 # Staff can use an explicitly assigned wallet through both PocketBase and Laravel.
 api(pb,'/api/collections/dropdown/records/'+wallet['id'],'PATCH',{'enum_1':'integrationstaffx','visibilitas':'2'},admin)
 _,unassignedCf=api(pb,'/api/collections/cashflow/records','POST',{'account_1':wallet['id'],'nominal':1,'mutasi':'in'},staff_auth['token'])
 denied('/api/collections/cashflow/records/'+unassignedCf['id'],'DELETE',auth_token=staff_auth['token'])
 api(pb,'/api/collections/cashflow/records/'+unassignedCf['id'],'DELETE',token=admin)
 api(pb,'/api/collections/dropdown/records/'+wallet['id'],'PATCH',{'enum_1':'integrationstaff','visibilitas':'2'},admin)
 _,staffCf=api(pb,'/api/collections/cashflow/records','POST',{'account_1':wallet['id'],'nominal':1,'mutasi':'in','created_at':'2026-10-18 04:00:00.000Z'},staff_auth['token'])
 api(pb,'/api/webhooks/batch','POST',{'request_id':'staff-assigned-wallet','events':[{'collection':'cashflow','event':'created','id':staffCf['id']}]},staff_auth['token'])
 api(pb,'/api/transactions/cashflow/'+staffCf['id'],'DELETE',token=staff_auth['token'])
 print('PASS: exact wallet assignments permit legitimate staff transactions')
 print('PASS: uploaded attachment is removed using the supported file- modifier')
 api(pb,'/api/transactions/cashflow/'+cashflowId,'DELETE',token=token)
 _,employee=api(pb,'/api/collections/user/records/'+user['id'],token=admin);assert employee['number']==0
 _,acc=api(pb,'/api/collections/dropdown/records/'+wallet['id'],token=admin);assert acc['number_1']==1000
 print('PASS: employee-only manual bon stays consistent through cashflow create/edit/delete')
 print('PASS: real salary/loan relations and cascade restore employee debt')
 print('PASS: real PocketBase batch → proxy → authenticated Laravel sync → retry → cascade delete restores stock and balance')
 # Editing a payment replacement must validate the final balance, not a temporary reversal.
 _,replaceWallet=api(pb,'/api/collections/dropdown/records','POST',{'id_lama':'rplw1','text_1':'replacement-wallet','number_1':100},admin)
 _,replaceMenu=api(pb,'/api/collections/menu/records','POST',{'jenis':'penjualan','total':100,'created_at':'2026-10-18 04:00:00.000Z'},admin)
 _,replaceOld=api(pb,'/api/collections/cashflow/records','POST',{'account_1':replaceWallet['id'],'nominal':100,'mutasi':'in','jenis':'penjualan','ref_baru':replaceMenu['id'],'created_at':'2026-10-18 04:00:00.000Z'},token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'replacement-old-create','events':[{'collection':'cashflow','event':'created','id':replaceOld['id']}]},token)
 _,spent=api(pb,'/api/collections/cashflow/records','POST',{'account_1':replaceWallet['id'],'nominal':190,'mutasi':'out','jenis':'operasional','created_at':'2026-10-18 04:00:00.000Z'},token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'replacement-spend','events':[{'collection':'cashflow','event':'created','id':spent['id']}]},token)
 _,oldPayment=api(pb,'/api/collections/cashflow/records/'+replaceOld['id'],token=token)
 _,replacement=api(pb,'/api/batch','POST',{'requests':[
  {'method':'DELETE','url':'/api/collections/cashflow/records/'+replaceOld['id']},
  {'method':'POST','url':'/api/collections/cashflow/records','body':{'account_1':replaceWallet['id'],'nominal':100,'mutasi':'in','jenis':'penjualan','ref_baru':replaceMenu['id'],'created_at':'2026-10-18 04:00:00.000Z'}}]},token)
 replacementEvents={'request_id':'replacement-complete','events':[{'collection':'cashflow','event':'deleted','id':replaceOld['id'],'record':oldPayment},{'collection':'cashflow','event':'created','id':replacement[1]['body']['id']}]}
 for _ in range(2):api(pb,'/api/webhooks/batch','POST',replacementEvents,token)
 _,replaceBalance=api(pb,'/api/collections/dropdown/records/'+replaceWallet['id'],token=token)
 assert replaceBalance['number_1']==10
 print('PASS: equivalent payment replacement with a low cash balance succeeds atomically and retries safely')
 # Product and opening stock must either both persist or both roll back.
 atomicProduct='atomicproduct01'
 invalidProduct='invalidproduct1'
 def productBatch(product_id,code,quantity):
  return {'requests':[
   {'method':'POST','url':'/api/collections/produk/records','body':{'id':product_id,'id_lama':code,'kategori':'Sparepart','merk':'Fixture','unit':'pcs','sell_6':200,'stok_3':0}},
   {'method':'POST','url':'/api/collections/log_stock/records','body':{'item_baru':product_id,'qty':quantity,'boolean':'in','price_1':0,'created_at':'2026-10-18 04:00:00.000Z'}}]}
 denied('/api/batch','POST',productBatch(invalidProduct,'BAD01',-1),token)
 denied('/api/collections/produk/records/'+invalidProduct,auth_token=token)
 _,newProductBatch=api(pb,'/api/batch','POST',productBatch(atomicProduct,'SKU01',7),token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'atomic-product-create','events':[{'collection':'log_stock','event':'created','id':newProductBatch[1]['body']['id']}]},token)
 _,newProduct=api(pb,'/api/collections/produk/records/'+atomicProduct,token=token)
 assert newProduct['stok_3']==7
 assert newProduct['id_lama']=='SKU01'
 # A duplicate SKU must fail the whole batch without leaving a second product.
 duplicateId='duplicateprod01'
 denied('/api/batch','POST',productBatch(duplicateId,'SKU01',2),token)
 denied('/api/collections/produk/records/'+duplicateId,auth_token=token)
 for quantity in [-1,0,0.5,8]:
  denied('/api/collections/log_stock/records','POST',{'item_baru':atomicProduct,'qty':quantity,'boolean':'out'},token)
 denied('/api/collections/produk/records/'+atomicProduct,'PATCH',{'stok_3':999},token)
 denied('/api/collections/produk/records/'+atomicProduct,'PATCH',{'beli':-1},token)
 api(pb,'/api/collections/produk/records/'+atomicProduct,'PATCH',{'beli':999},staff_auth['token'])
 api(pb,'/api/collections/produk/records/'+atomicProduct,'PATCH',{'stok_1':999},staff_auth['token'])
 denied('/api/collections/produk/records/'+atomicProduct,'DELETE',auth_token=staff_auth['token'])
 api(pb,'/api/collections/produk/records/'+atomicProduct,'PATCH',{'keterangan':'Metadata edit allowed'},staff_auth['token'])
 try:
  api('http://127.0.0.1:18080','/api/produks/'+atomicProduct,'PATCH',{'stok_3':999},token)
  raise AssertionError('Laravel accepted direct stock overwrite')
 except RuntimeError as error:assert ': 422 ' in str(error)
 # Retain one photo while appending another, then remove only the selected photo.
 def uploadProductPhoto(field,filename):
  payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode()+image+f'\r\n--{boundary}--\r\n'.encode())
  request=urllib.request.Request(pb+'/api/collections/produk/records/'+atomicProduct,data=payload,method='PATCH',headers={'Content-Type':'multipart/form-data; boundary='+boundary,'Authorization':'Bearer '+token})
  with urllib.request.urlopen(request) as response:return json.load(response)
 firstPhoto=uploadProductPhoto('file','first.png')['file'][0]
 twoPhotos=uploadProductPhoto('file+','second.png')['file']
 assert len(twoPhotos)==2 and firstPhoto in twoPhotos
 _,afterRemoval=api(pb,'/api/collections/produk/records/'+atomicProduct,'PATCH',{'file-':[firstPhoto]},token)
 assert len(afterRemoval['file'])==1 and firstPhoto not in afterRemoval['file']
 # Used products remain protected even after stock returns to zero.
 _,stockOut=api(pb,'/api/collections/log_stock/records','POST',{'item_baru':atomicProduct,'qty':7,'boolean':'out','price_1':0,'created_at':'2026-10-18 05:00:00.000Z'},token)
 api(pb,'/api/webhooks/batch','POST',{'request_id':'product-stock-zero','events':[{'collection':'log_stock','event':'created','id':stockOut['id']}]},token)
 _,zeroProduct=api(pb,'/api/collections/produk/records/'+atomicProduct,token=token);assert zeroProduct['stok_3']==0
 denied('/api/collections/produk/records/'+atomicProduct,'DELETE',auth_token=token)
 _,unusedProduct=api(pb,'/api/collections/produk/records','POST',{'id_lama':'UNUSD','kategori':'Sparepart','stok_3':0},token)
 api(pb,'/api/collections/produk/records/'+unusedProduct['id'],'DELETE',token=token)
 print('PASS: atomic product/opening stock, duplicate rollback, stock/price guards, role checks, selective photos and deletion history')
 # No webhook call is allowed between a native mutation and these assertions.
 def record(table, id): return api(pb,'/api/collections/'+table+'/records/'+id,token=token)[1]
 def operation(table, body=None, id=None, method='POST'):
  return {'method':method,'url':'/api/collections/'+table+'/records'+('/'+id if id else ''),**({'body':body} if body is not None else {})}
 _,atomicWallet=api(pb,'/api/collections/dropdown/records','POST',{'id_lama':'atomic-wallet','text_1':'atomic-wallet','number_1':100},admin)
 _,atomicItem=api(pb,'/api/collections/produk/records','POST',{'id_lama':'ATMC','kategori':'Sparepart','stok_3':0},admin)
 api(pb,'/api/collections/log_stock/records','POST',{'item_baru':atomicItem['id'],'qty':5,'boolean':'in','created_at':'2026-10-18 04:00:00.000Z'},token)
 assert record('produk',atomicItem['id'])['stok_3']==5
 # Individually valid debits become invalid together; the final guard must roll back all rows.
 for table,bodies in [
  ('cashflow',[{'account_1':atomicWallet['id'],'nominal':60,'mutasi':'out','jenis':'operasional'}]*2),
  ('log_stock',[{'item_baru':atomicItem['id'],'qty':3,'boolean':'out'}]*2)]:
  fixture_ids=['atomicfail00001','atomicfail00002']
  denied('/api/batch','POST',{'requests':[operation(table,dict(body,id=id)) for body,id in zip(bodies,fixture_ids)]},token)
  for id in fixture_ids: denied('/api/collections/'+table+'/records/'+id,auth_token=token)
  assert record('produk',atomicItem['id'])['stok_3']==5
  assert record('dropdown',atomicWallet['id'])['number_1']==100
 # Create -> edit -> delete restores both affected wallets, without notification or snapshots from a browser.
 _,targetWallet=api(pb,'/api/collections/dropdown/records','POST',{'id_lama':'atomic-target','text_1':'atomic-target','number_1':20},admin)
 _,transfer=api(pb,'/api/collections/cashflow/records','POST',{'account_1':atomicWallet['id'],'account_2':targetWallet['id'],'nominal':40,'mutasi':'out','jenis':'transfer'},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==60
 assert record('dropdown',targetWallet['id'])['number_1']==60
 api(pb,'/api/collections/cashflow/records/'+transfer['id'],'PATCH',{'nominal':25},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==75
 assert record('dropdown',targetWallet['id'])['number_1']==45
 api(pb,'/api/collections/cashflow/records/'+transfer['id'],'DELETE',token=token)
 assert record('dropdown',atomicWallet['id'])['number_1']==100
 assert record('dropdown',targetWallet['id'])['number_1']==20
 # A delete that would undo already spent income must leave both parent and children intact.
 _,blockedMenu=api(pb,'/api/collections/menu/records','POST',{'jenis':'penjualan','total':200,'created_at':'2026-10-18 04:00:00.000Z'},token)
 _,blockedCf=api(pb,'/api/collections/cashflow/records','POST',{'account_1':atomicWallet['id'],'nominal':200,'mutasi':'in','ref_baru':blockedMenu['id'],'jenis':'penjualan'},token)
 _,spend=api(pb,'/api/collections/cashflow/records','POST',{'account_1':atomicWallet['id'],'nominal':250,'mutasi':'out','jenis':'operasional'},token)
 denied('/api/collections/menu/records/'+blockedMenu['id'],'DELETE',auth_token=token)
 assert record('menu',blockedMenu['id'])['dibayar']==200
 assert record('cashflow',blockedCf['id'])['nominal']==200
 assert record('dropdown',atomicWallet['id'])['number_1']==50
 # Replacing an equivalent payment is valid even if the first delete temporarily goes negative.
 _,replaced=api(pb,'/api/batch','POST',{'requests':[
  operation('cashflow',id=blockedCf['id'],method='DELETE'),
  operation('cashflow',{'account_1':atomicWallet['id'],'nominal':200,'mutasi':'in','ref_baru':blockedMenu['id'],'jenis':'penjualan'})]},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==50
 assert record('menu',blockedMenu['id'])['dibayar']==200
 api(pb,'/api/collections/cashflow/records/'+spend['id'],'DELETE',token=token)
 api(pb,'/api/collections/menu/records/'+blockedMenu['id'],'DELETE',token=token)
 assert record('dropdown',atomicWallet['id'])['number_1']==100
 print('PASS: native atomic CRUD, cumulative overdraft/stock rollback, exact transfer reversal and failed cascade rollback without Laravel sync')
 # Durable receipts make lost-response retries exactly once, and resolution fences late requests.
 receiptId='integration-receipt-001'
 receiptBody={'requests':[operation('cashflow',{'id':'receiptcash0001','account_1':atomicWallet['id'],'nominal':12,'mutasi':'in','jenis':'pemasukanlain','created_at':'2026-10-18 04:00:00.000Z'})]}
 _,receiptFirst=api(pb,'/api/batch?atomic_request_id='+receiptId,'POST',receiptBody,token)
 _,receiptRetry=api(pb,'/api/batch?atomic_request_id='+receiptId,'POST',receiptBody,token)
 assert receiptFirst[0]['body']['id']==receiptRetry[0]['body']['id']
 assert record('dropdown',atomicWallet['id'])['number_1']==112
 _,resolution=api(pb,'/api/financial/requests/'+receiptId+'/resolve','POST',{},token)
 assert resolution['status']=='committed' and resolution['results'][-1]['body']['atomic']
 cancelledId='integration-cancel-001'
 assert api(pb,'/api/financial/requests/'+cancelledId+'/resolve','POST',{},token)[1]['status']=='cancelled'
 denied('/api/batch?atomic_request_id='+cancelledId,'POST',{'requests':[operation('cashflow',{'id':'cancelcash00001','account_1':atomicWallet['id'],'nominal':99,'mutasi':'in'})]},token)
 denied('/api/collections/cashflow/records/cancelcash00001',auth_token=token)
 assert record('dropdown',atomicWallet['id'])['number_1']==112
 # Another authenticated user cannot retrieve the owner's receipt.
 assert api(pb,'/api/financial/requests/'+receiptId+'/resolve','POST',{},staff_auth['token'])[1]['status']=='cancelled'
 print('PASS: exactly-once receipts, lost response resolution, late request cancellation and receipt owner isolation')
 # One stock edit may move a transaction between products; delete must undo the new product only.
 _,secondItem=api(pb,'/api/collections/produk/records','POST',{'id_lama':'ATMC2','kategori':'Sparepart','stok_3':0},admin)
 api(pb,'/api/collections/log_stock/records','POST',{'item_baru':secondItem['id'],'qty':4,'boolean':'in'},token)
 _,movedLog=api(pb,'/api/collections/log_stock/records','POST',{'item_baru':atomicItem['id'],'qty':3,'boolean':'out'},token)
 assert record('produk',atomicItem['id'])['stok_3']==2
 api(pb,'/api/collections/log_stock/records/'+movedLog['id'],'PATCH',{'item_baru':secondItem['id'],'qty':2},token)
 assert record('produk',atomicItem['id'])['stok_3']==5
 assert record('produk',secondItem['id'])['stok_3']==2
 api(pb,'/api/collections/log_stock/records/'+movedLog['id'],'DELETE',token=token)
 assert record('produk',secondItem['id'])['stok_3']==4
 # A mixed batch may temporarily overdraw an account, but the NET transfer must be valid.
 _,netTransfers=api(pb,'/api/batch','POST',{'requests':[
  operation('cashflow',{'account_1':atomicWallet['id'],'account_2':targetWallet['id'],'nominal':150,'mutasi':'out','jenis':'transfer'}),
  operation('cashflow',{'account_1':targetWallet['id'],'account_2':atomicWallet['id'],'nominal':100,'mutasi':'out','jenis':'transfer'})]},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==62
 assert record('dropdown',targetWallet['id'])['number_1']==70
 api(pb,'/api/batch','POST',{'requests':[operation('cashflow',id=r['body']['id'],method='DELETE') for r in netTransfers[:-1]]},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==112
 assert record('dropdown',targetWallet['id'])['number_1']==20
 # Native daily totals must match the report service used by the report page.
 reportFilter=urllib.parse.urlencode({'filter':'created_at >= "2026-10-18 00:00:00.000Z" && created_at < "2026-10-19 00:00:00.000Z"'})
 beforeReport=api(pb,'/api/collections/report/records?'+reportFilter,token=token)[1]['items'][0]
 api(pb,'/api/reports/recalculate','POST',{'date':'2026-10-18'},token)
 afterReport=api(pb,'/api/collections/report/records/'+beforeReport['id'],token=token)[1]
 for field in ['omset_toko','omset_servis','omset_minuman','laba_penjualan','laba_service','laba_minuman','piutang','hutang','kasir_toko','pemasukan_lain','pengeluaran_lain','operasional_toko']:
  assert beforeReport[field]==afterReport[field],(field,beforeReport[field],afterReport[field])
 print('PASS: cross-product stock edit/delete, net transfer validation and native/Laravel report parity')
 # Cross-session contention must not overspend or apply a duplicate request twice.
 from concurrent.futures import ThreadPoolExecutor
 def concurrent_call(body,request_id):
  try: return api(pb,'/api/batch?atomic_request_id='+request_id,'POST',body,token)[0]
  except RuntimeError: return 400
 duplicateBody={'requests':[operation('cashflow',{'id':'concurrentcf001','account_1':atomicWallet['id'],'nominal':2,'mutasi':'in'})]}
 with ThreadPoolExecutor(max_workers=2) as pool:
  statuses=list(pool.map(lambda _:concurrent_call(duplicateBody,'concurrent-same-001'),range(2)))
 assert 200 in statuses
 assert record('dropdown',atomicWallet['id'])['number_1']==114
 assert api(pb,'/api/financial/requests/concurrent-same-001/resolve','POST',{},token)[1]['status']=='committed'
 with ThreadPoolExecutor(max_workers=2) as pool:
  statuses=list(pool.map(lambda i:concurrent_call({'requests':[operation('cashflow',{'id':f'concurrentout0{i}','account_1':atomicWallet['id'],'nominal':70,'mutasi':'out','jenis':'operasional'})]},f'concurrent-out-00{i}'),range(2)))
 assert statuses.count(200)==1,statuses
 assert record('dropdown',atomicWallet['id'])['number_1']==44
 # Reject stale financial edits and absolute stock corrections INSIDE the transaction.
 denied('/api/collections/cashflow/records/receiptcash0001','PATCH',{'nominal':999,'atomic_expected':json.dumps({'nominal':11})},token)
 assert record('cashflow','receiptcash0001')['nominal']==12
 denied('/api/batch','POST',{'requests':[operation('log_stock',{'id':'stalestock00001','item_baru':atomicItem['id'],'qty':2,'boolean':'in','expected_stock':4})]},token)
 assert record('produk',atomicItem['id'])['stok_3']==5
 print('PASS: concurrent same-key retries, competing debits, stale edits and stale stock corrections')
 # Laravel can be unavailable without leaving a native CRUD half-applied.
 processes[1].terminate();processes[1].wait(timeout=5)
 _,independent=api(pb,'/api/batch?atomic_request_id=without-laravel-001','POST',{'requests':[operation('cashflow',{'id':'independentcf01','account_1':atomicWallet['id'],'nominal':3,'mutasi':'in'})]},token)
 assert record('dropdown',atomicWallet['id'])['number_1']==47
 api(pb,'/api/collections/cashflow/records/independentcf01','DELETE',token=token)
 assert record('dropdown',atomicWallet['id'])['number_1']==44
 processes[1]=subprocess.Popen(['php8.3','-S','127.0.0.1:18080','-t',str(root/'Backend/public')],cwd=root/'Backend',env=env,stdout=logs[1],stderr=subprocess.STDOUT)
 wait('http://127.0.0.1:18080/up')
 print('PASS: financial create/delete commits correctly while Laravel is stopped')
 # Customer debt is recalculated from the same committed menu/payment state.
 _,customerA=api(pb,'/api/collections/dropdown/records','POST',{'id_lama':'CSTA','text_1':'Customer A','kategori':'person','jenis':'customer','number_1':0},admin)
 _,customerB=api(pb,'/api/collections/dropdown/records','POST',{'id_lama':'CSTB','text_1':'Customer B','kategori':'person','jenis':'customer','number_1':0},admin)
 _,creditMenu=api(pb,'/api/collections/menu/records','POST',{'jenis':'penjualan','total':500,'person_baru':customerA['id'],'created_at':'2026-10-18 04:00:00.000Z'},token)
 assert record('dropdown',customerA['id'])['number_1']==500
 _,creditPayment=api(pb,'/api/collections/cashflow/records','POST',{'account_1':atomicWallet['id'],'ref_baru':creditMenu['id'],'nominal':100,'mutasi':'in','jenis':'penjualan','created_at':'2026-10-18 04:00:00.000Z'},token)
 assert record('dropdown',customerA['id'])['number_1']==400
 api(pb,'/api/collections/menu/records/'+creditMenu['id'],'PATCH',{'total':600,'person_baru':customerB['id']},token)
 assert record('dropdown',customerA['id'])['number_1']==0
 assert record('dropdown',customerB['id'])['number_1']==500
 api(pb,'/api/collections/cashflow/records/'+creditPayment['id'],'DELETE',token=token)
 assert record('dropdown',customerB['id'])['number_1']==600
 api(pb,'/api/collections/menu/records/'+creditMenu['id'],'DELETE',token=token)
 assert record('dropdown',customerB['id'])['number_1']==0
 api(pb,'/api/batch','POST',{'requests':[operation('dropdown',{'recalculate_person':True},id=customerB['id'],method='PATCH')]},token)
 assert record('dropdown',customerB['id'])['number_1']==0
 print('PASS: customer debt follows create, partial payment, changed person/total, payment delete and parent delete atomically')
 # Decimal money must not fail the balance scan with a float64 -> int64 conversion.
 _,decimalMenu=api(pb,'/api/collections/menu/records','POST',{'jenis':'penjualan','total':500.5,'person_baru':customerA['id'],'created_at':'2026-10-18 04:00:00.000Z'},token)
 assert record('dropdown',customerA['id'])['number_1']==500.5
 api(pb,'/api/collections/menu/records/'+decimalMenu['id'],'DELETE',token=token)
 assert record('dropdown',customerA['id'])['number_1']==0
 print('PASS: decimal customer balance is scanned without a float64/int64 conversion error')




 # Personal account data is protected by server rules, including direct unfiltered requests.
 _,mechanic=api(pb,'/api/collections/user/records','POST',{'email':'mechanic@example.test','username':'integrationmechanic','name':'Integration Mechanic','status':'Active','level':10,'password':'Local-Mechanic-Old-729!','passwordConfirm':'Local-Mechanic-Old-729!'},admin)
 _,mechanic_auth=api(pb,'/api/collections/user/auth-with-password','POST',{'identity':'integrationmechanic','password':'Local-Mechanic-Old-729!'})
 mechanicToken=mechanic_auth['token']
 _,period=api(pb,'/api/collections/menu/records','POST',{'jenis':'gaji','qty':30,'created_at':'2026-10-18 04:00:00.000Z'},admin)
 _,ownSalary=api(pb,'/api/collections/gaji/records','POST',{'person':'integrationmechanic','ref_baru':period['id'],'pokok':3000000,'alfa':1},admin)
 _,otherSalary=api(pb,'/api/collections/gaji/records','POST',{'person':'integrationcashier','ref_baru':period['id'],'pokok':6000000},admin)
 _,ownLoan=api(pb,'/api/collections/bon/records','POST',{'user':mechanic['id'],'nominal':100,'jenis':'out'},admin)
 _,legacyLoan=api(pb,'/api/collections/bon/records','POST',{'persontext':'integrationmechanic','nominal':20,'jenis':'in'},admin)
 _,otherLoan=api(pb,'/api/collections/bon/records','POST',{'user':user['id'],'persontext':'integrationmechanic','nominal':400,'jenis':'out'},admin)
 _,visibleSalary=api(pb,'/api/collections/gaji/records?expand=ref_baru',token=mechanicToken)
 assert {row['id'] for row in visibleSalary['items']}=={ownSalary['id']}
 assert visibleSalary['items'][0]['expand']['ref_baru']['qty']==30
 _,visibleBon=api(pb,'/api/collections/bon/records',token=mechanicToken)
 assert {row['id'] for row in visibleBon['items']}=={ownLoan['id'],legacyLoan['id']}
 denied('/api/collections/gaji/records/'+otherSalary['id'],auth_token=mechanicToken)
 denied('/api/collections/bon/records/'+otherLoan['id'],auth_token=mechanicToken)
 denied('/api/collections/bon/records/'+ownLoan['id'],'PATCH',{'nominal':0},mechanicToken)
 _,entrySalary=api(pb,'/api/collections/gaji/records','POST',{'person':'integrationmechanic','pokok':10000000},mechanicToken)
 api(pb,'/api/collections/gaji/records/'+entrySalary['id'],'PATCH',{'pokok':11000000},mechanicToken)
 denied('/api/collections/gaji/records/'+entrySalary['id'],'DELETE',auth_token=mechanicToken)
 try:
  api('http://127.0.0.1:18080','/api/bons',token=mechanicToken)
  raise AssertionError('Laravel exposed all employee loan records')
 except RuntimeError as error:
  assert ': 403 ' in str(error)
 # Loan history remains personal; explicit employee filters return only that employee.
 personalFilter='user = '+json.dumps(mechanic['id'])+' || (user = "" && (persontext = "integrationmechanic" || person.id_lama = "integrationmechanic" || ref_gaji.person = "integrationmechanic" || ref_cashflow.persontext = "integrationmechanic"))'
 _,personalBon=api(pb,'/api/collections/bon/records?'+urllib.parse.urlencode({'filter':personalFilter}),token=admin)
 assert {row['id'] for row in personalBon['items']}=={ownLoan['id'],legacyLoan['id']}
 _,personalSalary=api(pb,'/api/collections/gaji/records?'+urllib.parse.urlencode({'filter':'person = "integrationmechanic"','expand':'ref_baru'}),token=admin)
 assert {row['id'] for row in personalSalary['items']}=={ownSalary['id'],entrySalary['id']}
 # Level 1 sees all salaries; level 2 must not read other employees' salaries.
 _,allSalary=api(pb,'/api/collections/gaji/records',token=token)
 assert {row['id'] for row in allSalary['items']}=={ownSalary['id'],otherSalary['id'],entrySalary['id']}
 _,staffSalary=api(pb,'/api/collections/gaji/records','POST',{'person':'integrationstaff','ref_baru':period['id'],'pokok':2000000},admin)
 _,staffVisible=api(pb,'/api/collections/gaji/records',token=staff_auth['token'])
 assert {row['id'] for row in staffVisible['items']}=={staffSalary['id']}
 denied('/api/collections/gaji/records/'+otherSalary['id'],auth_token=staff_auth['token'])
 print('PASS: level 1 lists all salaries; level 2 and level 10 only read their own salaries')
 print('PASS: personal salary/loan reads and parent period relation; other employee reads and restricted deletes remain denied')
 # Editing a profile preserves protected fields; passwords require the correct old password.
 api(pb,'/api/collections/user/records/'+mechanic['id'],'PATCH',{'name':'Updated Mechanic','link_image':'https://example.test/avatar.png'},mechanicToken)
 denied('/api/collections/user/records/'+mechanic['id'],'PATCH',{'number':9999},mechanicToken)
 denied('/api/collections/user/records/'+mechanic['id'],'PATCH',{'status':'Inactive'},mechanicToken)
 denied('/api/collections/user/records/'+mechanic['id'],'PATCH',{'oldPassword':'incorrect','password':'Local-Mechanic-New-729!','passwordConfirm':'Local-Mechanic-New-729!'},mechanicToken)
 api(pb,'/api/collections/user/records/'+mechanic['id'],'PATCH',{'oldPassword':'Local-Mechanic-Old-729!','password':'Local-Mechanic-New-729!','passwordConfirm':'Local-Mechanic-New-729!'},mechanicToken)
 denied('/api/collections/user/auth-with-password','POST',{'identity':'integrationmechanic','password':'Local-Mechanic-Old-729!'})
 _,newAuth=api(pb,'/api/collections/user/auth-with-password','POST',{'identity':'integrationmechanic','password':'Local-Mechanic-New-729!'})
 assert newAuth['record']['id']==mechanic['id']
 assert newAuth['record']['name']=='Updated Mechanic'
 api(pb,'/api/collections/user/auth-refresh','POST',{},newAuth['token'])
 print('PASS: self profile edit and password change with subsequent login and token refresh')
 # Capture confirmation email in a local SMTP sink. Nothing is sent externally.
 mail_queue=queue.Queue()
 class MailSink(socketserver.StreamRequestHandler):
  def handle(self):
   def reply(text): self.wfile.write((text+'\r\n').encode());self.wfile.flush()
   reply('220 integration.local ESMTP')
   while True:
    line=self.rfile.readline()
    if not line:return
    command=line.decode(errors='replace').strip().upper()
    if command.startswith(('EHLO','HELO')):reply('250 integration.local')
    elif command.startswith('DATA'):
     reply('354 End with a single dot')
     body=[]
     while True:
      part=self.rfile.readline()
      if part in [b'.\r\n',b'']:break
      body.append(part[1:] if part.startswith(b'..') else part)
     mail_queue.put(b''.join(body));reply('250 Accepted')
    elif command.startswith('QUIT'):reply('221 Bye');return
    else:reply('250 OK')
 smtp_server=socketserver.ThreadingTCPServer(('127.0.0.1',0),MailSink)
 smtp_server.daemon_threads=True
 threading.Thread(target=smtp_server.serve_forever,daemon=True).start()
 api(pb,'/api/settings','PATCH',{'smtp':{'enabled':True,'host':'127.0.0.1','port':smtp_server.server_address[1],'tls':False,'username':'','password':''}},admin)
 api(pb,'/api/collections/user/request-email-change','POST',{'newEmail':'confirmed-mechanic@example.test'},newAuth['token'])
 message=email.message_from_bytes(mail_queue.get(timeout=10))
 content=''.join(part.get_payload(decode=True).decode(errors='replace') for part in message.walk() if part.get_content_type() in ['text/plain','text/html'])
 confirmation=re.search(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',content)
 assert confirmation,'No confirmation token in local test email'
 _,beforeConfirmation=api(pb,'/api/collections/user/records/'+mechanic['id'],token=admin)
 assert beforeConfirmation['email']=='mechanic@example.test'
 denied('/api/collections/user/confirm-email-change','POST',{'token':confirmation.group(0),'password':'wrong-password'})
 api(pb,'/api/collections/user/confirm-email-change','POST',{'token':confirmation.group(0),'password':'Local-Mechanic-New-729!'})
 _,emailAuth=api(pb,'/api/collections/user/auth-with-password','POST',{'identity':'confirmed-mechanic@example.test','password':'Local-Mechanic-New-729!'})
 assert emailAuth['record']['id']==mechanic['id']
 print('PASS: email changes only after confirming the emailed token with the correct password (local SMTP)')
 if os.environ.get('PM_SCALE_TEST')=='1':
  # Synthetic history only, in the disposable database: 200k alternating movements net to zero.
  fixture=sqlite3.connect(data/'data.db')
  fixture.executemany('INSERT INTO log_stock(id,item_baru,qty,boolean,created_at) VALUES (?,?,?,?,?)',
   ((f'perf{i:011d}',atomicItem['id'],1,'in' if i%2==0 else 'out','2020-01-01 00:00:00.000Z') for i in range(200000)))
  fixture.commit();fixture.close()
  started=time.monotonic()
  _,scaleLog=api(pb,'/api/collections/log_stock/records','POST',{'item_baru':atomicItem['id'],'qty':1,'boolean':'out','created_at':'2026-10-18 04:00:00.000Z'},token)
  assert record('produk',atomicItem['id'])['stok_3']==4
  api(pb,'/api/collections/log_stock/records/'+scaleLog['id'],'DELETE',token=token)
  assert record('produk',atomicItem['id'])['stok_3']==5
  elapsed=time.monotonic()-started
  assert elapsed<25,elapsed
  print(f'PASS: create/delete over 200,000 synthetic historical stock rows restored exact stock in {elapsed:.2f}s')
 passed=True
except Exception:
 print('Isolated logs:',tmp)
 raise
finally:
 if smtp_server:
  smtp_server.shutdown();smtp_server.server_close()
 for process in processes:process.terminate()
 for process in processes:
  try:process.wait(timeout=5)
  except subprocess.TimeoutExpired:process.kill()
 for f in logs:f.close()
 if passed:
  import shutil
  shutil.rmtree(tmp)
