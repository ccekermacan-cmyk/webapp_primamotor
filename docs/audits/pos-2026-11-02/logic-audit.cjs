// Read-only probes of pure frontend helpers; no server or database access.
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.join(root,'Frontend/node_modules/typescript'));
async function load(file){const source=fs.readFileSync(path.join(root,'Frontend/src/lib',file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
(async()=>{
 const {validateCheckout}=await load('posValidation.ts');const {isIncomeTransaction}=await load('posTransactions.ts');const {readPosDraft}=await load('posDraft.ts');
 const valid={menu:'Penjualan',cartCount:1,mekanik:[],cashflow:[{accountId:'fixture',nominal:100}],isOnline:false,marketplace:'',adminFee:0,noteMenu:'',payment:'Tunai',tempoDate:''};
 const result={negativePaymentErrors:validateCheckout({...valid,cashflow:[{accountId:'fixture',nominal:-100}]}),nanPaymentErrors:validateCheckout({...valid,cashflow:[{accountId:'fixture',nominal:NaN}]}),grosirIncome:isIncomeTransaction('Grosir'),draftWithoutTimestampAccepted:!!readPosDraft(()=>JSON.stringify({cart:[{}]}),Date.now(),false),serviceWithoutItemsDraftAccepted:!!readPosDraft(()=>JSON.stringify({cart:[],selectedMenu:'Service',formBayar:{noteMenu:'Servis tanpa barang',mekanikList:[{idLama:'fixture',ongkos:50000}]},savedAt:Date.now()}),Date.now(),false)};
 fs.writeFileSync(path.join(__dirname,'logic-results.json'),JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exitCode=1;});
