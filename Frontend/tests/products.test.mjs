import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/products.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {normalizeProductCode,productValidationError,stockAdjustment,isProductCodeConflict,isProductVideo,displayProductCode}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('product codes retain alphanumeric SKUs and normalize numeric leading zeros safely',()=>{
 assert.equal(normalizeProductCode('  AB-01  '),'AB-01');
 assert.equal(normalizeProductCode('00042'),'42');
 assert.equal(displayProductCode('AB1'),'AB1');
 assert.equal(displayProductCode('42'),'00042');
 assert.equal(displayProductCode(null),'N/A');
 assert.equal(normalizeProductCode('00000'),'0');
 assert.equal(normalizeProductCode('0001234567890123456789'),'1234567890123456789');
});
test('prices and stock reject negatives, fractions and nonfinite inputs',()=>{
 const valid={kategori:'Sparepart',merk:'Brand',unit:'pcs',sell_6:100};
 assert.equal(productValidationError(valid),'');
 for(const value of [-1,NaN,Infinity,0.5]) assert.ok(productValidationError({...valid,stok_3:value}));
 assert.ok(productValidationError({...valid,sell_6:0}));
 assert.ok(productValidationError({...valid,merk:'  '}));
});
test('editing metadata preserves concurrent stock; explicit stock changes reject stale snapshots',()=>{
 assert.equal(stockAdjustment(10,10,8),0);
 assert.equal(stockAdjustment(10,7,10),-3);
 assert.throws(()=>stockAdjustment(10,7,8),/Stok berubah/);
 assert.throws(()=>stockAdjustment(10,-1,10),/Stok tidak valid/);
});
test('only confirmed product-code collisions are classified as uniqueness conflicts',()=>{
 assert.equal(isProductCodeConflict({response:{data:{requests:{0:{response:{data:{id_lama:{code:'validation_not_unique'}}}}}}}}),true);
 assert.equal(isProductCodeConflict({status:400,response:{data:{sell_6:{code:'validation_min_greater_equal_than_required'}}}}),false);
 assert.equal(isProductCodeConflict({status:400,response:{data:{id:{code:'validation_not_unique'}}}}),false);
});

test('stored and newly selected video attachments render as video',()=>{
 assert.equal(isProductVideo('https://example.test/clip.MP4?thumb=80x80'),true);
 assert.equal(isProductVideo({name:'upload',type:'video/webm'}),true);
 assert.equal(isProductVideo({name:'clip.mov'}),true);
 assert.equal(isProductVideo({name:'photo.png'}),false);
});
