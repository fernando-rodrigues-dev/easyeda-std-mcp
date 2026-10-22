import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {buildWebMCP} from '../scripts/build-webmcp.mjs';
const bundle=await buildWebMCP({write:false});

async function browser({storage=true}={}) {
  const tools=new Map(),labels=[];
  let source={head:{docType:'1',editorVersion:'6.5.51'},canvas:'CA~1200~1200',shape:[]},writes=0;
  const context=vm.createContext({console,crypto:webcrypto,TextEncoder,Uint8Array,AbortController,setTimeout,clearTimeout,Blob,URL,indexedDB:storage?new IDBFactory():undefined,
    localStorage:{getItem:()=>null,setItem:()=>{}},
    document:{modelContext:{registerTool(tool){if(tools.has(tool.name))throw Error('Nome duplicado.');tools.set(tool.name,tool);},unregisterTool(name){tools.delete(name);}},querySelectorAll:()=>[],querySelector:()=>({getAttribute:()=>'test-document'})},
    api(action,p){if(action==='getSource')return structuredClone(source);if(action==='applySource'){source=structuredClone(p.source);writes++;return;}if(action==='getSelectedIds')return [];if(action==='createToolbarButton')return {text:text=>labels.push(text)};throw Error('API inesperada: '+action);},
  });
  context.window=context;
  vm.runInContext(bundle,context);
  await context.EasyEDAStdWebMCP.ready;
  const call=async(name,args={})=>{const result=await tools.get(name).execute(args);return {error:!!result.isError,data:result.isError?result.content[0].text:JSON.parse(result.content[0].text)};};
  return {tools,context,call,labels,get source(){return source;},get writes(){return writes;}};
}

test('browser bundle is reproducible, browser-only and registers the full tool catalog',async()=>{
  assert.equal(bundle,fs.readFileSync(new URL('../cloud/Conectar-WebMCP.js',import.meta.url),'utf8'));
  assert.ok(!bundle.includes('127.0.0.1:3579'));
  const b=await browser();assert.equal(b.tools.size,38);
  const status=await b.call('easyeda_status');assert.equal(status.data.transport,'webmcp');assert.equal(status.data.api_available,true);
  for(const tool of b.tools.values())assert.equal(tool.inputSchema.type,'object');
  const search=await b.call('easyeda_search_components',{query:'R_0805',limit:5});assert.equal(search.data.total,2);
});

test('browser revisions match stdio, validate inputs and reject another tab',async()=>{
  const b=await browser(),read=await b.call('easyeda_read_schematic');
  assert.equal(read.data.revision,createHash('sha256').update(JSON.stringify(['test-document',b.source])).digest('hex'));
  assert.equal((await b.call('easyeda_read_schematic',{session_id:'another-tab'})).error,true);
  const invalid=await b.call('easyeda_add_text',{expected_revision:read.data.revision,text:'invalid~separator',x:10,y:20});
  assert.equal(invalid.error,true);assert.equal(b.writes,0);
  assert.equal((await b.call('easyeda_status',{unexpected:true})).error,true);
});

test('browser edits commit a backup before mutation and serialize concurrent revisions',async()=>{
  const b=await browser(),read=await b.call('easyeda_read_schematic');
  const args={expected_revision:read.data.revision,text:'Teste cloud',x:100,y:100};
  const [first,second]=await Promise.all([b.call('easyeda_add_text',args),b.call('easyeda_add_text',args)]);
  assert.equal(first.error,false);assert.equal(second.error,true);assert.match(second.data,/revisão mudou/);
  assert.equal(b.writes,1);assert.equal(b.source.shape.length,1);
  const backups=await b.call('easyeda_list_backups');assert.equal(backups.data.backups.length,1);assert.equal(backups.data.backups[0].file,first.data.backup_file);
  const db=await new Promise((resolve,reject)=>{const req=b.context.indexedDB.open('easyeda-std-webmcp',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const row=await new Promise((resolve,reject)=>{const tx=db.transaction('sources'),req=tx.objectStore('sources').getAll();tx.oncomplete=()=>resolve(req.result[0]);tx.onerror=reject;});
  assert.equal(row.source.shape.length,0);db.close();
});

test('a missing backup store blocks mutation, and reinstallation replaces registrations',async()=>{
  const b=await browser({storage:false}),read=await b.call('easyeda_read_schematic');
  const edit=await b.call('easyeda_add_text',{expected_revision:read.data.revision,text:'Blocked',x:10,y:20});
  assert.equal(edit.error,true);assert.match(edit.data,/IndexedDB indisponível/);assert.equal(b.writes,0);
  const oldTool=b.tools.get('easyeda_status');
  vm.runInContext(bundle,b.context);await b.context.EasyEDAStdWebMCP.ready;assert.equal(b.tools.size,38);
  assert.equal((await oldTool.execute({})).isError,true);
});
