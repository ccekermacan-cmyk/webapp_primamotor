import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let serial = 0;
async function configuration(hostname) {
  const source = fs.readFileSync(new URL('../src/services/datasource.ts', import.meta.url), 'utf8');
  const prefix = `const window = {location:{hostname:${JSON.stringify(hostname)}}}; const __DATASOURCE__ = {pbPort:'19090',apiPort:'19000',pbUrl:'https://data.example.test',apiUrl:'https://api.example.test/api'};\n`;
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return (await import('data:text/javascript;base64,' + Buffer.from(prefix + js + `\n//${serial++}`).toString('base64'))).datasource;
}
test('local frontend follows changed datasource ports', async () => {
  assert.deepEqual(await configuration('localhost'), {pocketbase:'http://localhost:19090',laravel:'http://localhost:19000/api'});
  assert.equal((await configuration('127.0.0.1')).pocketbase,'http://127.0.0.1:19090');
});
test('public frontend uses HTTPS hostnames, not Docker host ports', async () => {
  assert.deepEqual(await configuration('web.example.test'), {pocketbase:'https://data.example.test',laravel:'https://api.example.test/api'});
});
